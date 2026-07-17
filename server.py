#!/usr/bin/env python3
"""Arena Stars 3D — strona gry + ranking online.

Na Renderze profile są zapisywane w Neon Postgres przez zmienną DATABASE_URL.
Lokalnie, gdy DATABASE_URL nie istnieje, serwer używa players.json.
Każdy gracz rozgrywa osobny mecz solo; online są profile i TOP 200.
"""
from __future__ import annotations

import json
import math
import random
import mimetypes
import os
import socket
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "players.json"
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8765"))
VISIBLE_RANKING_SIZE = 200
ACTIVE_TIMEOUT = 20.0
MAX_BODY = 64 * 1024
DUEL_PLAYER_TIMEOUT = 12.0
DUEL_WAIT_TIMEOUT = 45.0
DUEL_BOT_WAIT = 30.0
DUEL_FINISH_TTL = 30.0
DUEL_ARENA = 17.5
DUEL_BULLET_SPEED = 18.0
DUEL_BULLET_DAMAGE = 22
DUEL_BULLET_RADIUS = 0.19
DUEL_PLAYER_RADIUS = 0.75
DUEL_HP_MULTIPLIER = 3.5  # „o 250% więcej” = 350% wartości bazowej
DUEL_MAX_ROUNDS = 3
DUEL_WINS_TO_TAKE_MATCH = 2
DUEL_BUSH_REVEAL_DISTANCE = 4.5
DUEL_TICK_RATE = 20.0  # niezależna symulacja bota i pocisków 20 razy na sekundę
# Szybka, symetryczna mapa: dwie ściany i cztery małe pola krzaków.
DUEL_WALLS = (
    (-5.4, 0.0, 3.4, 1.7),
    (5.4, 0.0, 3.4, 1.7),
)
DUEL_BUSHES = (
    (-10.2, -5.7, 1.85), (-10.2, 5.7, 1.85),
    (10.2, -5.7, 1.85), (10.2, 5.7, 1.85),
)

lock = threading.RLock()
profiles: dict[str, dict[str, Any]] = {}
active_players: dict[str, float] = {}
duel_waiting: dict[str, dict[str, Any]] = {}
duel_player_match: dict[str, str] = {}
duel_matches: dict[str, dict[str, Any]] = {}
duel_counter = 0


def now() -> float:
    return time.time()


def clean_id(value: Any) -> str:
    text = "".join(ch for ch in str(value or "") if ch.isalnum() or ch in "-_")
    return text[:80]


def clean_name(value: Any) -> str:
    text = " ".join(str(value or "Gracz").strip().split())
    text = "".join(ch for ch in text if ch.isprintable() and ch not in "<>\r\n\t")
    return text[:18] or "Gracz"


def clean_number(value: Any, upper: int = 2_000_000_000) -> int:
    try:
        num = int(float(value))
    except (TypeError, ValueError):
        return 0
    return max(0, min(upper, num))


def touch(player_id: str) -> None:
    if player_id:
        active_players[player_id] = now()


def cleanup_active() -> None:
    cutoff = now() - ACTIVE_TIMEOUT
    expired = [pid for pid, timestamp in active_players.items() if timestamp < cutoff]
    for pid in expired:
        active_players.pop(pid, None)


def online_count() -> int:
    cleanup_active()
    return len(active_players)


def public_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row.get("id", "")),
        "name": clean_name(row.get("name")),
        "points": clean_number(row.get("points")),
        "trophies": clean_number(row.get("trophies")),
    }


# ----------------------------- Neon Postgres -----------------------------

def db_connect():
    try:
        import psycopg  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "Brakuje pakietu psycopg. Uruchom: pip install -r requirements.txt"
        ) from exc
    return psycopg.connect(DATABASE_URL, autocommit=True, connect_timeout=10)


def init_database() -> None:
    if not DATABASE_URL:
        return
    with db_connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS players (
                player_id VARCHAR(80) PRIMARY KEY,
                name VARCHAR(18) NOT NULL,
                points BIGINT NOT NULL DEFAULT 0 CHECK (points >= 0),
                trophies BIGINT NOT NULL DEFAULT 0 CHECK (trophies >= 0),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS players_ranking_idx "
            "ON players (points DESC, trophies DESC, player_id ASC)"
        )


def db_upsert_profile(payload: dict[str, Any]) -> dict[str, Any] | None:
    player_id = clean_id(payload.get("playerId"))
    if not player_id:
        return None
    name = clean_name(payload.get("name"))
    points = clean_number(payload.get("points"))
    trophies = clean_number(payload.get("trophies"))
    with db_connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO players (player_id, name, points, trophies, updated_at)
            VALUES (%s, %s, %s, %s, NOW())
            ON CONFLICT (player_id) DO UPDATE SET
                name = EXCLUDED.name,
                points = GREATEST(players.points, EXCLUDED.points),
                trophies = GREATEST(players.trophies, EXCLUDED.trophies),
                updated_at = NOW()
            RETURNING player_id, name, points, trophies
            """,
            (player_id, name, points, trophies),
        )
        row = cur.fetchone()
    touch(player_id)
    if not row:
        return None
    return {"id": row[0], "name": row[1], "points": row[2], "trophies": row[3]}


def db_leaderboard_payload(player_id: str = "") -> dict[str, Any]:
    with db_connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT player_id, name, points, trophies
            FROM players
            ORDER BY points DESC, trophies DESC, LOWER(name) ASC, player_id ASC
            LIMIT %s
            """,
            (VISIBLE_RANKING_SIZE,),
        )
        rows = [
            {"id": row[0], "name": row[1], "points": row[2], "trophies": row[3]}
            for row in cur.fetchall()
        ]
        cur.execute("SELECT COUNT(*) FROM players")
        total = int(cur.fetchone()[0])
        position = None
        if player_id:
            cur.execute(
                """
                WITH ranked AS (
                    SELECT player_id,
                           ROW_NUMBER() OVER (
                               ORDER BY points DESC, trophies DESC, LOWER(name) ASC, player_id ASC
                           ) AS position
                    FROM players
                )
                SELECT position FROM ranked WHERE player_id = %s
                """,
                (player_id,),
            )
            result = cur.fetchone()
            position = int(result[0]) if result else None
    return {
        "players": [public_row(row) for row in rows],
        "position": position,
        "totalPlayers": total,
        "online": online_count(),
        "visible": VISIBLE_RANKING_SIZE,
        "storage": "neon",
    }


# ----------------------------- lokalny JSON -----------------------------

def load_profiles() -> None:
    global profiles
    if DATABASE_URL:
        profiles = {}
        return
    try:
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            profiles = {}
            return
        cleaned: dict[str, dict[str, Any]] = {}
        for player_id, entry in data.items():
            pid = clean_id(player_id)
            if not pid or not isinstance(entry, dict):
                continue
            cleaned[pid] = {
                "id": pid,
                "name": clean_name(entry.get("name")),
                "points": clean_number(entry.get("points")),
                "trophies": clean_number(entry.get("trophies")),
            }
        profiles = cleaned
    except (OSError, json.JSONDecodeError):
        profiles = {}


def save_profiles() -> None:
    temp = DATA_FILE.with_suffix(".tmp")
    temp.write_text(json.dumps(profiles, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(DATA_FILE)


def json_upsert_profile(payload: dict[str, Any]) -> dict[str, Any] | None:
    player_id = clean_id(payload.get("playerId"))
    if not player_id:
        return None
    old = profiles.get(player_id, {"id": player_id, "name": "Gracz", "points": 0, "trophies": 0})
    entry = {
        "id": player_id,
        "name": clean_name(payload.get("name", old["name"])),
        "points": max(clean_number(old.get("points")), clean_number(payload.get("points"))),
        "trophies": max(clean_number(old.get("trophies")), clean_number(payload.get("trophies"))),
    }
    profiles[player_id] = entry
    save_profiles()
    touch(player_id)
    return entry


def json_leaderboard_payload(player_id: str = "") -> dict[str, Any]:
    rows = sorted(
        profiles.values(),
        key=lambda row: (
            -clean_number(row.get("points")),
            -clean_number(row.get("trophies")),
            str(row.get("name", "")).casefold(),
            str(row.get("id", "")),
        ),
    )
    position = next((index + 1 for index, row in enumerate(rows) if row["id"] == player_id), None)
    return {
        "players": [public_row(row) for row in rows[:VISIBLE_RANKING_SIZE]],
        "position": position,
        "totalPlayers": len(rows),
        "online": online_count(),
        "visible": VISIBLE_RANKING_SIZE,
        "storage": "json",
    }


def upsert_profile(payload: dict[str, Any]) -> dict[str, Any] | None:
    return db_upsert_profile(payload) if DATABASE_URL else json_upsert_profile(payload)


def leaderboard_payload(player_id: str = "") -> dict[str, Any]:
    return db_leaderboard_payload(player_id) if DATABASE_URL else json_leaderboard_payload(player_id)


# ----------------------------- pojedynki 1v1 -----------------------------

def clean_skin(value: Any) -> str:
    return "cosmic" if str(value) == "cosmic" else "classic"


def clean_float(value: Any, lower: float, upper: float, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return max(lower, min(upper, number))


def normalize_duel_angle(value: Any, default: float = 0.0) -> float:
    """Kanonizuje kierunek celowania do zakresu [-pi, pi]."""
    try:
        angle = float(value)
    except (TypeError, ValueError):
        angle = float(default)
    if not math.isfinite(angle):
        angle = float(default)
    return math.atan2(math.sin(angle), math.cos(angle))


def duel_point_in_bush(x: float, z: float) -> bool:
    return any((x - bx) ** 2 + (z - bz) ** 2 < radius ** 2 for bx, bz, radius in DUEL_BUSHES)


def duel_hits_wall(x: float, z: float, radius: float = 0.12) -> bool:
    if abs(x) > DUEL_ARENA - radius or abs(z) > DUEL_ARENA - radius:
        return True
    for wx, wz, width, depth in DUEL_WALLS:
        if wx - width / 2 - radius < x < wx + width / 2 + radius and wz - depth / 2 - radius < z < wz + depth / 2 + radius:
            return True
    return False


def resolve_duel_position(x: float, z: float, radius: float = DUEL_PLAYER_RADIUS) -> tuple[float, float, bool]:
    x = max(-DUEL_ARENA + radius, min(DUEL_ARENA - radius, x))
    z = max(-DUEL_ARENA + radius, min(DUEL_ARENA - radius, z))
    collided = False
    for wx, wz, width, depth in DUEL_WALLS:
        min_x, max_x = wx - width / 2 - radius, wx + width / 2 + radius
        min_z, max_z = wz - depth / 2 - radius, wz + depth / 2 + radius
        if min_x < x < max_x and min_z < z < max_z:
            collided = True
            distances = ((abs(x - min_x), "left"), (abs(max_x - x), "right"), (abs(z - min_z), "top"), (abs(max_z - z), "bottom"))
            side = min(distances, key=lambda item: item[0])[1]
            if side == "left": x = min_x
            elif side == "right": x = max_x
            elif side == "top": z = min_z
            else: z = max_z
    return x, z, collided


def move_duel_position(x: float, z: float, dx: float, dz: float, radius: float = DUEL_PLAYER_RADIUS) -> tuple[float, float]:
    """Przesuwa postać osobno po osi X i Z, co usuwa blokowanie na rogach ścian."""
    next_x = max(-DUEL_ARENA + radius, min(DUEL_ARENA - radius, x + dx))
    if not duel_hits_wall(next_x, z, radius):
        x = next_x
    next_z = max(-DUEL_ARENA + radius, min(DUEL_ARENA - radius, z + dz))
    if not duel_hits_wall(x, next_z, radius):
        z = next_z
    return x, z


def segment_circle_hit_t(x0: float, z0: float, x1: float, z1: float, cx: float, cz: float, radius: float) -> float | None:
    """Zwraca pierwszy parametr t w [0,1], w którym odcinek trafia koło."""
    dx, dz = x1 - x0, z1 - z0
    fx, fz = x0 - cx, z0 - cz
    a = dx * dx + dz * dz
    if a <= 1e-12:
        return 0.0 if fx * fx + fz * fz <= radius * radius else None
    b = 2.0 * (fx * dx + fz * dz)
    c = fx * fx + fz * fz - radius * radius
    disc = b * b - 4.0 * a * c
    if disc < 0:
        return None
    root = math.sqrt(disc)
    values = [(-b - root) / (2.0 * a), (-b + root) / (2.0 * a)]
    valid = [value for value in values if 0.0 <= value <= 1.0]
    return min(valid) if valid else None


def segment_aabb_hit_t(x0: float, z0: float, x1: float, z1: float, min_x: float, max_x: float, min_z: float, max_z: float) -> float | None:
    """Pierwsze przecięcie odcinka z prostokątem, metodą slab."""
    dx, dz = x1 - x0, z1 - z0
    enter, leave = 0.0, 1.0
    for start, delta, lower, upper in ((x0, dx, min_x, max_x), (z0, dz, min_z, max_z)):
        if abs(delta) < 1e-12:
            if start < lower or start > upper:
                return None
            continue
        first = (lower - start) / delta
        second = (upper - start) / delta
        if first > second:
            first, second = second, first
        enter = max(enter, first)
        leave = min(leave, second)
        if enter > leave:
            return None
    return enter if 0.0 <= enter <= 1.0 else None


def first_wall_hit_t(x0: float, z0: float, x1: float, z1: float, radius: float) -> float | None:
    hits: list[float] = []
    for wx, wz, width, depth in DUEL_WALLS:
        hit = segment_aabb_hit_t(
            x0, z0, x1, z1,
            wx - width / 2 - radius, wx + width / 2 + radius,
            wz - depth / 2 - radius, wz + depth / 2 + radius,
        )
        if hit is not None:
            hits.append(hit)
    # Granica areny usuwa pocisk dopiero po wyjściu poza planszę.
    if abs(x1) > DUEL_ARENA - radius or abs(z1) > DUEL_ARENA - radius:
        hits.append(1.0)
    return min(hits) if hits else None


def duel_line_blocked(x0: float, z0: float, x1: float, z1: float, radius: float = DUEL_BULLET_RADIUS) -> bool:
    return first_wall_hit_t(x0, z0, x1, z1, radius) is not None


def spawn_duel_bullet(match: dict[str, Any], owner: dict[str, Any], angle: float, client_seq: int | None = None) -> None:
    match["bullet_seq"] += 1
    angle = normalize_duel_angle(angle, owner.get("angle", 0.0))
    match["bullets"].append({
        "id": f'{match["id"]}-b{match["bullet_seq"]}',
        "owner_id": owner["id"],
        "client_seq": client_seq,
        "x": owner["x"] + math.sin(angle) * 1.05,
        "z": owner["z"] + math.cos(angle) * 1.05,
        "vx": math.sin(angle) * DUEL_BULLET_SPEED,
        "vz": math.cos(angle) * DUEL_BULLET_SPEED,
        "life": 2.4,
        "damage": DUEL_BULLET_DAMAGE,
        "radius": DUEL_BULLET_RADIUS,
    })


def duel_public_player(player: dict[str, Any], viewer: dict[str, Any] | None = None) -> dict[str, Any]:
    in_bush = duel_point_in_bush(float(player["x"]), float(player["z"]))
    hidden = False
    if viewer is not None and viewer["id"] != player["id"] and in_bush:
        distance = math.hypot(float(player["x"]) - float(viewer["x"]), float(player["z"]) - float(viewer["z"]))
        hidden = distance > DUEL_BUSH_REVEAL_DISTANCE and now() >= float(player.get("revealed_until", 0.0))
    row = {
        "id": player["id"], "name": player["name"], "skin": player["skin"],
        "hp": max(0, int(round(player["hp"]))), "maxHp": int(player["max_hp"]),
        "isBot": bool(player.get("is_bot", False)), "hidden": hidden, "inBush": in_bush,
    }
    if not hidden:
        row.update({
            "x": round(float(player["x"]), 3), "z": round(float(player["z"]), 3),
            "angle": round(normalize_duel_angle(player["angle"]), 4),
            "vx": round(float(player.get("vx", 0.0)), 3), "vz": round(float(player.get("vz", 0.0)), 3),
        })
    return row


def duel_payload(match: dict[str, Any], player_id: str) -> dict[str, Any]:
    current = now()
    player_ids = list(match["players"].keys())
    opponent_id = next((pid for pid in player_ids if pid != player_id), "")
    wins = match.get("round_wins", {})
    return {
        "ok": True,
        "status": match["status"],
        "matchId": match["id"],
        "startIn": max(0.0, float(match["start_at"] - current)) if match["status"] == "countdown" else 0.0,
        "players": [duel_public_player(player, match["players"].get(player_id)) for player in match["players"].values()],
        "bullets": [
            {
                "id": bullet["id"],
                "ownerId": bullet["owner_id"],
                "x": round(float(bullet["x"]), 3),
                "z": round(float(bullet["z"]), 3),
                "vx": round(float(bullet["vx"]), 3),
                "vz": round(float(bullet["vz"]), 3),
                "clientSeq": bullet.get("client_seq"),
            }
            for bullet in match["bullets"]
        ],
        "winnerId": match.get("winner_id"),
        "reason": match.get("reason", ""),
        "round": int(match.get("round", 1)),
        "maxRounds": DUEL_MAX_ROUNDS,
        "yourWins": int(wins.get(player_id, 0)),
        "opponentWins": int(wins.get(opponent_id, 0)),
        "roundDraws": int(match.get("round_draws", 0)),
        "roundResult": match.get("round_result", ""),
        "roundEventSeq": int(match.get("round_event_seq", 0)),
        "you": player_id,
        "serverTime": round(current, 4),
        "stateSeq": int(match.get("state_seq", 0)),
        "ackShotSeq": int(match["players"].get(player_id, {}).get("last_client_shot_seq", 0)),
        "build": "rundy-best-of-3-hp350-v1",
    }


def finish_duel(match: dict[str, Any], winner_id: str | None, reason: str) -> None:
    if match["status"] == "finished":
        return
    match["status"] = "finished"
    match["winner_id"] = winner_id
    match["reason"] = reason
    match["finished_at"] = now()
    match["bullets"] = []
    match["state_seq"] = int(match.get("state_seq", 0)) + 1


def reset_duel_round(match: dict[str, Any]) -> None:
    """Ustawia obie postacie na pozycjach startowych z pełnym życiem."""
    for player in match["players"].values():
        player["x"] = float(player.get("spawn_x", 0.0))
        player["z"] = float(player.get("spawn_z", 0.0))
        player["angle"] = float(player.get("spawn_angle", 0.0))
        player["hp"] = int(player["max_hp"])
        player["vx"] = 0.0
        player["vz"] = 0.0
        player["last_shot"] = 0.0
        player["last_move"] = now()
        player["last_client_shot_seq"] = 0
        player["revealed_until"] = 0.0
        player["last_seen"] = now()
        if player.get("is_bot"):
            player["next_turn"] = now() + 0.55
            player["stuck_for"] = 0.0
    match["bullets"] = []
    match["start_at"] = now() + 3.0
    match["last_tick"] = now()
    match["status"] = "countdown"
    match["state_seq"] = int(match.get("state_seq", 0)) + 1


def complete_duel_round(match: dict[str, Any], winner_id: str | None) -> None:
    """Zapisuje wynik rundy i kończy lub uruchamia następną rundę."""
    if match.get("status") == "finished":
        return
    current_round = int(match.get("round", 1))
    wins = match.setdefault("round_wins", {pid: 0 for pid in match["players"]})
    if winner_id is None:
        match["round_draws"] = int(match.get("round_draws", 0)) + 1
        match["round_result"] = "draw"
    else:
        wins[winner_id] = int(wins.get(winner_id, 0)) + 1
        match["round_result"] = winner_id
    match["round_event_seq"] = int(match.get("round_event_seq", 0)) + 1

    champion = next((pid for pid, value in wins.items() if int(value) >= DUEL_WINS_TO_TAKE_MATCH), None)
    if champion is not None:
        finish_duel(match, champion, "Koniec meczu: zwycięstwo 2 rundy.")
        return
    if current_round >= DUEL_MAX_ROUNDS:
        # Zgodnie z zasadą: wygrywa tylko osoba z 2 rundami. Bez 2 zwycięstw jest remis meczu.
        finish_duel(match, None, "Koniec meczu: po 3 rundach nikt nie wygrał dwóch rund.")
        return

    match["round"] = current_round + 1
    reset_duel_round(match)


def update_duel_bots(match: dict[str, Any], step: float, current: float) -> None:
    players = list(match["players"].values())
    for bot in (p for p in players if p.get("is_bot") and p.get("hp", 0) > 0):
        target = next((p for p in players if not p.get("is_bot") and p.get("hp", 0) > 0), None)
        if not target:
            continue

        dx, dz = target["x"] - bot["x"], target["z"] - bot["z"]
        distance = max(0.001, math.hypot(dx, dz))
        nx, nz = dx / distance, dz / distance
        bot["angle"] = math.atan2(dx, dz)

        if current >= bot.get("next_turn", 0.0):
            bot["strafe_dir"] = random.choice((-1.0, 1.0))
            bot["next_turn"] = current + random.uniform(0.7, 1.4)

        if distance > 10.0:
            desired_x, desired_z = nx, nz
        elif distance < 5.5:
            desired_x, desired_z = -nx, -nz
        else:
            side = bot.get("strafe_dir", 1.0)
            desired_x, desired_z = -nz * side + nx * 0.16, nx * side + nz * 0.16
            length = max(0.001, math.hypot(desired_x, desired_z))
            desired_x, desired_z = desired_x / length, desired_z / length

        # Testujemy kilka kierunków. Dzięki temu bot obchodzi narożnik zamiast napierać na ścianę.
        base_angle = math.atan2(desired_x, desired_z)
        offsets = (0.0, 0.42, -0.42, 0.82, -0.82, 1.35, -1.35, math.pi)
        best: tuple[float, float, float] | None = None
        for offset in offsets:
            move_angle = base_angle + offset
            move_x, move_z = math.sin(move_angle), math.cos(move_angle)
            candidate_x, candidate_z, collided = resolve_duel_position(
                bot["x"] + move_x * bot["speed"] * step,
                bot["z"] + move_z * bot["speed"] * step,
            )
            moved = math.hypot(candidate_x - bot["x"], candidate_z - bot["z"])
            new_distance = math.hypot(target["x"] - candidate_x, target["z"] - candidate_z)
            preferred = 7.4
            score = moved * 20.0 - abs(new_distance - preferred) * 0.08
            if collided:
                score -= 0.7
            if duel_line_blocked(candidate_x, candidate_z, target["x"], target["z"], 0.08):
                score -= 0.25
            if best is None or score > best[0]:
                best = (score, candidate_x, candidate_z)

        old_x, old_z = bot["x"], bot["z"]
        if best is not None:
            bot["x"], bot["z"] = best[1], best[2]
        moved = math.hypot(bot["x"] - old_x, bot["z"] - old_z)
        if moved < 0.002:
            bot["stuck_for"] = float(bot.get("stuck_for", 0.0)) + step
        else:
            bot["stuck_for"] = 0.0
        if bot.get("stuck_for", 0.0) > 0.28:
            # Awaryjny impuls prostopadły — bot nigdy nie zostaje na stałe przy ścianie.
            side = -bot.get("strafe_dir", 1.0)
            bot["strafe_dir"] = side
            bot["x"], bot["z"], _ = resolve_duel_position(
                bot["x"] - nz * side * bot["speed"] * step * 1.8,
                bot["z"] + nx * side * bot["speed"] * step * 1.8,
            )
            bot["stuck_for"] = 0.0

        bot["vx"] = (bot["x"] - old_x) / max(step, 0.001)
        bot["vz"] = (bot["z"] - old_z) / max(step, 0.001)
        bot["last_seen"] = current

        clear_shot = not duel_line_blocked(bot["x"], bot["z"], target["x"], target["z"])
        if clear_shot and distance < 16.5 and current - bot["last_shot"] >= bot["fire_cooldown"]:
            bot["last_shot"] = current
            bot["revealed_until"] = current + 0.85
            aim = bot["angle"] + random.uniform(-0.055, 0.055)
            spawn_duel_bullet(match, bot, aim)


def advance_duel(match: dict[str, Any]) -> None:
    current = now()
    if match["status"] == "countdown" and current >= match["start_at"]:
        match["status"] = "playing"
        match["last_tick"] = current
        match["state_seq"] = int(match.get("state_seq", 0)) + 1
    if match["status"] not in {"countdown", "playing"}:
        return

    players = list(match["players"].values())
    stale = [player for player in players if not player.get("is_bot") and current - player["last_seen"] > DUEL_PLAYER_TIMEOUT]
    if stale:
        alive = [player for player in players if player not in stale]
        finish_duel(match, alive[0]["id"] if len(alive) == 1 else None, "Przeciwnik rozłączył się.")
        return
    if match["status"] != "playing":
        return

    remaining = min(0.30, max(0.0, current - match["last_tick"]))
    match["last_tick"] = current
    changed = False
    while remaining > 1e-7:
        step = min(0.025, remaining)
        remaining -= step
        before = [(p["x"], p["z"]) for p in players if p.get("is_bot")]
        update_duel_bots(match, step, current)
        after = [(p["x"], p["z"]) for p in players if p.get("is_bot")]
        changed = changed or before != after

        kept: list[dict[str, Any]] = []
        for bullet in match["bullets"]:
            x0, z0 = float(bullet["x"]), float(bullet["z"])
            x1 = x0 + float(bullet["vx"]) * step
            z1 = z0 + float(bullet["vz"]) * step
            bullet["life"] -= step
            radius = float(bullet.get("radius", DUEL_BULLET_RADIUS))
            if bullet["life"] <= 0:
                changed = True
                continue

            wall_t = first_wall_hit_t(x0, z0, x1, z1, radius)
            target = next((p for p in players if p["id"] != bullet["owner_id"] and p.get("hp", 0) > 0), None)
            hit_t = None
            if target:
                hit_t = segment_circle_hit_t(
                    x0, z0, x1, z1,
                    float(target["x"]), float(target["z"]),
                    DUEL_PLAYER_RADIUS + radius,
                )

            if hit_t is not None and (wall_t is None or hit_t <= wall_t + 1e-8):
                bullet["x"] = x0 + (x1 - x0) * hit_t
                bullet["z"] = z0 + (z1 - z0) * hit_t
                target["hp"] = max(0, target["hp"] - bullet["damage"])
                changed = True
                continue
            if wall_t is not None:
                changed = True
                continue

            bullet["x"], bullet["z"] = x1, z1
            kept.append(bullet)
            changed = True
        match["bullets"] = kept

        # Oceniamy zgony dopiero po wszystkich pociskach z tej klatki.
        # Dzięki temu dwa trafienia w tej samej chwili dają prawdziwy remis rundy.
        dead = [p for p in players if p.get("hp", 0) <= 0]
        if dead:
            alive = [p for p in players if p.get("hp", 0) > 0]
            complete_duel_round(match, alive[0]["id"] if len(alive) == 1 else None)
            return

    if changed:
        match["state_seq"] = int(match.get("state_seq", 0)) + 1


def cleanup_duels() -> None:
    current = now()
    for player_id, waiting in list(duel_waiting.items()):
        if current - waiting["last_seen"] > DUEL_WAIT_TIMEOUT:
            duel_waiting.pop(player_id, None)
    for match_id, match in list(duel_matches.items()):
        advance_duel(match)
        if match["status"] == "finished" and current - match.get("finished_at", current) > DUEL_FINISH_TTL:
            duel_matches.pop(match_id, None)
            for player_id in list(match["players"]):
                if duel_player_match.get(player_id) == match_id:
                    duel_player_match.pop(player_id, None)


def create_duel_player(payload: dict[str, Any], player_id: str, x: float, z: float, angle: float) -> dict[str, Any]:
    base_hp = clean_float(payload.get("maxHp"), 100, 400, 150)
    max_hp = int(round(base_hp * DUEL_HP_MULTIPLIER))
    return {
        "id": player_id,
        "name": clean_name(payload.get("name")),
        "skin": clean_skin(payload.get("skin")),
        "x": x,
        "z": z,
        "angle": angle,
        "spawn_x": x,
        "spawn_z": z,
        "spawn_angle": angle,
        "hp": max_hp,
        "max_hp": max_hp,
        "speed": clean_float(payload.get("speed"), 3.0, 12.0, 6.3),
        "fire_cooldown": clean_float(payload.get("fireCooldown"), 0.08, 0.8, 0.25),
        "last_shot": 0.0,
        "last_seen": now(),
        "last_move": now(),
        "vx": 0.0, "vz": 0.0, "revealed_until": 0.0,
        "last_client_shot_seq": 0,
        "is_bot": False,
    }


def create_duel_bot(payload: dict[str, Any], bot_id: str, x: float, z: float, angle: float) -> dict[str, Any]:
    # Bot jest dokładną kopią statystyk gracza: ten sam HP, ruch, szybkostrzelność i skórka.
    bot = create_duel_player(payload, bot_id, x, z, angle)
    bot.update({
        "name": "Bot Kopia",
        "is_bot": True,
        "strafe_dir": random.choice((-1.0, 1.0)),
        "next_turn": now() + 0.8,
        "stuck_for": 0.0,
    })
    return bot


def create_duel_match(first_payload: dict[str, Any], first_id: str, second_payload: dict[str, Any], second_id: str, second_is_bot: bool = False) -> dict[str, Any]:
    global duel_counter
    duel_counter += 1
    match_id = f"duel-{int(now() * 1000)}-{duel_counter}"
    first = create_duel_player(first_payload, first_id, 0.0, 12.0, 3.14159265)
    second = create_duel_bot(second_payload, second_id, 0.0, -12.0, 0.0) if second_is_bot else create_duel_player(second_payload, second_id, 0.0, -12.0, 0.0)
    match = {
        "id": match_id,
        "status": "countdown",
        "created_at": now(),
        "start_at": now() + 3.0,
        "last_tick": now(),
        "players": {first_id: first, second_id: second},
        "bullets": [],
        "bullet_seq": 0,
        "winner_id": None,
        "reason": "",
        "round": 1,
        "round_wins": {first_id: 0, second_id: 0},
        "round_draws": 0,
        "round_result": "",
        "round_event_seq": 0,
        "state_seq": 0,
    }
    duel_matches[match_id] = match
    duel_player_match[first_id] = match_id
    if not second_is_bot:
        duel_player_match[second_id] = match_id
    return match


def join_duel(payload: dict[str, Any]) -> dict[str, Any]:
    global duel_counter
    cleanup_duels()
    player_id = clean_id(payload.get("playerId"))
    if not player_id:
        return {"error": "Brak identyfikatora gracza."}

    existing_match_id = duel_player_match.get(player_id)
    if existing_match_id and existing_match_id in duel_matches:
        match = duel_matches[existing_match_id]
        if match["status"] == "finished":
            duel_player_match.pop(player_id, None)
            existing_match_id = None
        else:
            match["players"][player_id]["last_seen"] = now()
            advance_duel(match)
            return duel_payload(match, player_id)

    waiting = duel_waiting.get(player_id)
    if waiting:
        waiting.update({"last_seen": now(), "name": clean_name(payload.get("name")), "payload": payload})
        elapsed = now() - waiting["created_at"]
        if elapsed >= DUEL_BOT_WAIT:
            duel_waiting.pop(player_id, None)
            bot_id = f"bot-{int(now() * 1000)}-{player_id[:10]}"
            match = create_duel_match(payload, player_id, payload, bot_id, second_is_bot=True)
            return duel_payload(match, player_id)
        return {
            "ok": True,
            "status": "waiting",
            "waitingSince": waiting["created_at"],
            "waitRemaining": max(0.0, DUEL_BOT_WAIT - elapsed),
        }

    opponent_id = next((pid for pid in duel_waiting if pid != player_id), None)
    if opponent_id:
        opponent = duel_waiting.pop(opponent_id)
        match = create_duel_match(payload, player_id, opponent["payload"], opponent_id, second_is_bot=False)
        return duel_payload(match, player_id)

    duel_waiting[player_id] = {
        "created_at": now(),
        "last_seen": now(),
        "name": clean_name(payload.get("name")),
        "payload": payload,
    }
    return {
        "ok": True,
        "status": "waiting",
        "waitingSince": duel_waiting[player_id]["created_at"],
        "waitRemaining": DUEL_BOT_WAIT,
    }


def duel_state(match_id: str, player_id: str) -> dict[str, Any] | None:
    cleanup_duels()
    match = duel_matches.get(match_id)
    if not match or player_id not in match["players"]:
        return None
    match["players"][player_id]["last_seen"] = now()
    advance_duel(match)
    return duel_payload(match, player_id)


def duel_action(payload: dict[str, Any]) -> dict[str, Any] | None:
    cleanup_duels()
    match_id = clean_id(payload.get("matchId"))
    player_id = clean_id(payload.get("playerId"))
    match = duel_matches.get(match_id)
    if not match or player_id not in match["players"]:
        return None
    player = match["players"][player_id]
    current = now()
    advance_duel(match)
    player["last_seen"] = current

    player["angle"] = normalize_duel_angle(payload.get("angle"), player["angle"])
    if match["status"] == "playing":
        requested_x = clean_float(payload.get("x"), -DUEL_ARENA, DUEL_ARENA, player["x"])
        requested_z = clean_float(payload.get("z"), -DUEL_ARENA, DUEL_ARENA, player["z"])
        # Darmowy hosting potrafi odpowiadać z opóźnieniem. Większe okno czasu
        # pozwala zaakceptować legalny ruch wykonany podczas oczekiwania na HTTP.
        elapsed = max(0.01, min(1.25, current - player["last_move"]))
        max_distance = player["speed"] * elapsed + 1.0
        dx, dz = requested_x - player["x"], requested_z - player["z"]
        distance = (dx * dx + dz * dz) ** 0.5
        if distance > max_distance:
            scale = max_distance / distance
            dx, dz = dx * scale, dz * scale
        old_x, old_z = player["x"], player["z"]
        player["x"], player["z"] = move_duel_position(player["x"], player["z"], dx, dz)
        player["vx"] = (player["x"] - old_x) / elapsed
        player["vz"] = (player["z"] - old_z) / elapsed
        player["last_move"] = current
    else:
        player["vx"] = 0.0
        player["vz"] = 0.0

    shots = payload.get("shots")
    if not isinstance(shots, list):
        shots = [{"seq": int(player.get("last_client_shot_seq", 0)) + 1, "angle": payload.get("angle")}] if payload.get("shoot") else []
    fresh: list[tuple[int, dict[str, Any]]] = []
    for shot in shots[:8]:
        if not isinstance(shot, dict):
            continue
        seq = clean_number(shot.get("seq"), 2_000_000_000)
        if seq > int(player.get("last_client_shot_seq", 0)):
            fresh.append((seq, shot))
    fresh.sort(key=lambda item: item[0])
    if fresh and match["status"] == "playing" and current - player["last_shot"] >= player["fire_cooldown"] * 0.90:
        seq, shot = fresh[0]
        player["last_shot"] = current
        player["last_client_shot_seq"] = seq
        player["revealed_until"] = current + 0.85
        angle = normalize_duel_angle(shot.get("angle"), player["angle"])
        spawn_duel_bullet(match, player, angle, seq)
    advance_duel(match)
    match["state_seq"] = int(match.get("state_seq", 0)) + 1
    return duel_payload(match, player_id)


def leave_duel(payload: dict[str, Any]) -> dict[str, Any]:
    player_id = clean_id(payload.get("playerId"))
    match_id = clean_id(payload.get("matchId"))
    duel_waiting.pop(player_id, None)
    match = duel_matches.get(match_id or duel_player_match.get(player_id, ""))
    if match and player_id in match["players"] and match["status"] != "finished":
        opponent = next((pid for pid in match["players"] if pid != player_id), None)
        finish_duel(match, opponent, "Przeciwnik opuścił pojedynek.")
    return {"ok": True}


def duel_tick_loop() -> None:
    """Symuluje boty i pociski niezależnie od częstotliwości zapytań przeglądarki."""
    interval = 1.0 / DUEL_TICK_RATE
    while True:
        started = time.monotonic()
        try:
            with lock:
                cleanup_duels()
        except Exception as exc:
            print(f"Błąd pętli pojedynku: {exc}")
        elapsed = time.monotonic() - started
        time.sleep(max(0.005, interval - elapsed))


class Handler(BaseHTTPRequestHandler):
    server_version = "ArenaStarsRenderNeon/1.4-bot-localny"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[{self.log_date_time_string()}] {self.address_string()} - {fmt % args}")

    def send_json(self, data: Any, status: int = 200) -> None:
        raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        try:
            self.wfile.write(raw)
        except (BrokenPipeError, ConnectionResetError):
            # Przeglądarka mogła anulować spóźnione zapytanie; serwer ma działać dalej.
            pass

    def read_json(self) -> dict[str, Any] | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None
        if length <= 0 or length > MAX_BODY:
            return None
        try:
            value = json.loads(self.rfile.read(length).decode("utf-8"))
            return value if isinstance(value, dict) else None
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/leaderboard":
            query = parse_qs(parsed.query)
            player_id = clean_id((query.get("playerId") or [""])[0])
            try:
                with lock:
                    touch(player_id)
                    self.send_json(leaderboard_payload(player_id))
            except Exception as exc:  # serwer ma zwrócić czytelny błąd zamiast się wyłączyć
                print(f"Błąd rankingu: {exc}")
                self.send_json({"error": "Błąd połączenia z bazą danych."}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if parsed.path == "/api/duel/state":
            query = parse_qs(parsed.query)
            match_id = clean_id((query.get("matchId") or [""])[0])
            player_id = clean_id((query.get("playerId") or [""])[0])
            with lock:
                state = duel_state(match_id, player_id)
            if state is None:
                self.send_json({"error": "Nie znaleziono pojedynku."}, HTTPStatus.NOT_FOUND)
            else:
                self.send_json(state)
            return
        if parsed.path == "/api/health":
            try:
                if DATABASE_URL:
                    with db_connect() as conn, conn.cursor() as cur:
                        cur.execute("SELECT 1")
                        cur.fetchone()
                self.send_json({"ok": True, "storage": "neon" if DATABASE_URL else "json", "build": "rundy-best-of-3-hp350-v1"})
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        self.serve_static(parsed.path)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        payload = self.read_json()
        if payload is None:
            self.send_json({"error": "Nieprawidłowe dane."}, HTTPStatus.BAD_REQUEST)
            return
        if parsed.path == "/api/profile":
            try:
                with lock:
                    entry = upsert_profile(payload)
                    if not entry:
                        self.send_json({"error": "Brak identyfikatora gracza."}, HTTPStatus.BAD_REQUEST)
                        return
                    response = leaderboard_payload(entry["id"])
                    response.update({"ok": True, "profile": public_row(entry)})
                    self.send_json(response)
            except Exception as exc:
                print(f"Błąd zapisu profilu: {exc}")
                self.send_json({"error": "Nie udało się zapisać profilu."}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if parsed.path == "/api/duel/join":
            try:
                with lock:
                    result = join_duel(payload)
                status = HTTPStatus.BAD_REQUEST if "error" in result else HTTPStatus.OK
                self.send_json(result, status)
            except Exception as exc:
                print(f"Błąd kolejki pojedynku: {exc}")
                self.send_json({"error": "Nie udało się uruchomić kolejki pojedynku."}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        if parsed.path == "/api/duel/action":
            try:
                with lock:
                    result = duel_action(payload)
                if result is None:
                    self.send_json({"error": "Nie znaleziono pojedynku."}, HTTPStatus.NOT_FOUND)
                else:
                    self.send_json(result)
            except Exception as exc:
                print(f"Błąd aktualizacji pojedynku: {exc}")
                self.send_json({"error": "Nie udało się zaktualizować pojedynku."}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        if parsed.path == "/api/duel/leave":
            try:
                with lock:
                    result = leave_duel(payload)
                self.send_json(result)
            except Exception as exc:
                print(f"Błąd opuszczania pojedynku: {exc}")
                self.send_json({"ok": True})
            return
        self.send_json({"error": "Nieznany adres API."}, HTTPStatus.NOT_FOUND)

    def serve_static(self, request_path: str) -> None:
        rel = request_path.lstrip("/") or "index.html"
        candidate = (ROOT / rel).resolve()
        if ROOT not in candidate.parents and candidate != ROOT:
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        if not candidate.exists() or not candidate.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        mime = mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
        raw = candidate.read_bytes()
        self.send_response(HTTPStatus.OK)
        content_type = (
            f"{mime}; charset=utf-8"
            if mime.startswith("text/") or mime in {"application/javascript", "application/json"}
            else mime
        )
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        cache_value = "no-store" if candidate.suffix.lower() in {".html", ".js", ".css"} else "no-cache"
        self.send_header("Cache-Control", cache_value)
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        self.wfile.write(raw)


def local_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


if __name__ == "__main__":
    load_profiles()
    init_database()
    threading.Thread(target=duel_tick_loop, name="duel-tick", daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("\nArena Stars 3D — PRZETRWANIE + POJEDYNKI 1V1/BOT + TOP 200")
    print(f"Adres lokalny: http://localhost:{PORT}")
    print(f"Adres w tej samej sieci: http://{local_ip()}:{PORT}")
    print(f"Zapis profili: {'Neon Postgres' if DATABASE_URL else 'lokalny players.json'}")
    print("Zatrzymanie serwera: Ctrl+C\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSerwer zatrzymany.")
    finally:
        server.server_close()
