#!/usr/bin/env python3
"""Arena Stars 3D — strona gry + ranking online.

Na Renderze profile są zapisywane w Neon Postgres przez zmienną DATABASE_URL.
Lokalnie, gdy DATABASE_URL nie istnieje, serwer używa players.json.
Każdy gracz rozgrywa osobny mecz solo; online są profile i TOP 200.
"""
from __future__ import annotations

import base64
import hmac
import hashlib
import html as html_lib
import json
import io
import math
import random
import re
import unicodedata
import uuid
import mimetypes
import os
import secrets
import socket
import threading
import time
import zipfile
import stat
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse, unquote, quote

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "players.json"
SETTINGS_FILE = ROOT / "game_settings.json"
ACCOUNTS_FILE = ROOT / "accounts.json"
CHAT_FILE = ROOT / "chat_messages.json"
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8765"))
VISIBLE_RANKING_SIZE = 200
ACTIVE_TIMEOUT = 20.0
MAX_BODY = 256 * 1024
ADMIN_UPLOAD_MAX_BODY = 24 * 1024 * 1024
ADMIN_UPLOAD_MAX_RAW = 40 * 1024 * 1024
AUTH_SESSION_TTL = 30 * 24 * 60 * 60
PASSWORD_RESET_TTL = 30 * 60
PASSWORD_RESET_RATE_WINDOW = 15 * 60
PASSWORD_RESET_RATE_MAX = 3
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
PASSWORD_RESET_FROM = os.environ.get("PASSWORD_RESET_FROM", "").strip()
APP_PUBLIC_URL = os.environ.get("APP_PUBLIC_URL", "").strip().rstrip("/")
CHAT_MAX_MESSAGE = 300
CHAT_MAX_RECIPIENTS = 20
CHAT_HISTORY_LIMIT = 160
DB_SCHEMA_VERSION = 7
PROFILE_DATA_VERSION = 1
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


# Sekrety administracyjne są wyłącznie po stronie serwera.
# Tymczasowa konfiguracja właściciela panelu.
# Hasło jest ustawione bezpośrednio na 1234, a dostęp ograniczony do jednego ID konta.
ADMIN_PASSWORD = "1234"
ADMIN_RECOVERY_CODE = os.environ.get("ADMIN_RECOVERY_CODE", "FORZAHORIZON6").strip()
ADMIN_PLAYER_ID = clean_admin_player_id = "594caf3b-f84e-4627-9724-c15ca547ab42"
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
GITHUB_REPO = os.environ.get("GITHUB_REPO", os.environ.get("RENDER_GIT_REPO_SLUG", "")).strip()
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", os.environ.get("RENDER_GIT_BRANCH", "main")).strip() or "main"
RENDER_DEPLOY_HOOK = os.environ.get("RENDER_DEPLOY_HOOK", "").strip()
ADMIN_SESSION_TTL = 8 * 60 * 60
ADMIN_ALLOWED_FILES = {"index.html", "game.js", "server.py", "requirements.txt", "Dockerfile", "render.yaml", ".python-version", "DATABASE_SCHEMA.sql"}
admin_sessions: dict[str, dict[str, Any]] = {}
admin_login_attempts: dict[str, dict[str, float | int]] = {}
local_accounts: dict[str, dict[str, Any]] = {}
local_auth_sessions: dict[str, dict[str, Any]] = {}
local_password_reset_tokens: dict[str, dict[str, Any]] = {}
password_reset_attempts: dict[str, list[float]] = {}
local_chat_messages: list[dict[str, Any]] = []
local_chat_seq = 0

DEFAULT_GAME_CONFIG: dict[str, Any] = {
    "survivalBotLevel": 5,
    "duelBotLevel": 5,
    "duelBotWaitSeconds": 30,
    "duelHpMultiplier": 3.5,
    "duelMaxRounds": 3,
    "duelWinsToTakeMatch": 2,
    "duelWinCoins": 25,
    "duelWinTrophies": 10,
    "duelWinPoints": 2000,
    "duelDrawCoins": 5,
    "duelDrawTrophies": 4,
    "duelDrawPoints": 500,
    "soloEnabled": True,
    "duelEnabled": True,
    "announcement": "",
    "profanityBanMinutes": 120,
    "banEscalationMultiplier": 1.5,
    "sqlSyncSeconds": 2.5,
    "customModes": [],
}
game_config: dict[str, Any] = dict(DEFAULT_GAME_CONFIG)


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


def clean_revision(value: Any) -> int:
    try:
        return max(0, min(9_000_000_000_000_000_000, int(value)))
    except (TypeError, ValueError, OverflowError):
        return 0


def clean_profile_data(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    cleaned: dict[str, Any] = {}
    for key, item in list(value.items())[:80]:
        safe_key = clean_mode_text(key, 48)
        if not safe_key:
            continue
        if isinstance(item, (str, int, float, bool)) or item is None:
            cleaned[safe_key] = item
        elif isinstance(item, list):
            cleaned[safe_key] = item[:50]
        elif isinstance(item, dict):
            cleaned[safe_key] = dict(list(item.items())[:50])
    try:
        raw = json.dumps(cleaned, ensure_ascii=False)
        if len(raw.encode("utf-8")) > 64 * 1024:
            return {}
    except (TypeError, ValueError):
        return {}
    return cleaned


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



def clamp_int(value: Any, lower: int, upper: int, default: int) -> int:
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        return default
    return max(lower, min(upper, number))


def clean_mode_text(value: Any, limit: int) -> str:
    text = " ".join(str(value or "").strip().split())
    text = "".join(ch for ch in text if ch.isprintable() and ch not in "<>\r\n\t")
    return text[:limit]


def sanitize_game_config(value: Any) -> dict[str, Any]:
    source = value if isinstance(value, dict) else {}
    result = dict(DEFAULT_GAME_CONFIG)
    result["survivalBotLevel"] = clamp_int(source.get("survivalBotLevel"), 1, 10, 5)
    result["duelBotLevel"] = clamp_int(source.get("duelBotLevel"), 1, 10, 5)
    result["duelBotWaitSeconds"] = clamp_int(source.get("duelBotWaitSeconds"), 3, 120, 30)
    result["duelHpMultiplier"] = round(clean_float(source.get("duelHpMultiplier"), 1.0, 10.0, 3.5), 2)
    result["duelMaxRounds"] = clamp_int(source.get("duelMaxRounds"), 1, 9, 3)
    result["duelWinsToTakeMatch"] = clamp_int(source.get("duelWinsToTakeMatch"), 1, result["duelMaxRounds"], 2)
    result["duelWinCoins"] = clamp_int(source.get("duelWinCoins"), 0, 1_000_000, 25)
    result["duelWinTrophies"] = clamp_int(source.get("duelWinTrophies"), 0, 1_000_000, 10)
    result["duelWinPoints"] = clamp_int(source.get("duelWinPoints"), 0, 100_000_000, 2000)
    result["duelDrawCoins"] = clamp_int(source.get("duelDrawCoins"), 0, 1_000_000, 5)
    result["duelDrawTrophies"] = clamp_int(source.get("duelDrawTrophies"), 0, 1_000_000, 4)
    result["duelDrawPoints"] = clamp_int(source.get("duelDrawPoints"), 0, 100_000_000, 500)
    result["soloEnabled"] = bool(source.get("soloEnabled", True))
    result["duelEnabled"] = bool(source.get("duelEnabled", True))
    result["announcement"] = clean_mode_text(source.get("announcement"), 180)
    if "profanityBanMinutes" in source:
        profanity_minutes = source.get("profanityBanMinutes")
    elif "profanityBanHours" in source:
        profanity_minutes = clean_float(source.get("profanityBanHours"), 0.0167, 168.0, 2.0) * 60.0
    else:
        profanity_minutes = 120.0
    result["profanityBanMinutes"] = round(clean_float(profanity_minutes, 1.0, 10080.0, 120.0), 1)
    result["banEscalationMultiplier"] = 1.5
    result["sqlSyncSeconds"] = round(clean_float(source.get("sqlSyncSeconds"), 1.0, 60.0, 2.5), 2)
    modes: list[dict[str, Any]] = []
    raw_modes = source.get("customModes")
    if isinstance(raw_modes, list):
        seen: set[str] = set()
        for raw in raw_modes[:20]:
            if not isinstance(raw, dict):
                continue
            mode_id = clean_id(raw.get("id"))[:30]
            if not mode_id or mode_id in {"solo", "duel"} or mode_id in seen:
                continue
            name = clean_mode_text(raw.get("name"), 32) or "Nowy tryb"
            description = clean_mode_text(raw.get("description"), 110)
            base = "duel" if str(raw.get("base")) == "duel" else "solo"
            modes.append({"id": mode_id, "name": name, "description": description, "base": base, "enabled": bool(raw.get("enabled", True))})
            seen.add(mode_id)
    result["customModes"] = modes
    return result


def public_game_config() -> dict[str, Any]:
    config = sanitize_game_config(game_config)
    # Alias zachowuje zgodność ze starszymi klientami podczas wdrożenia.
    config["profanityBanHours"] = round(float(config["profanityBanMinutes"]) / 60.0, 4)
    return config


def load_game_config() -> None:
    global game_config
    try:
        if DATABASE_URL:
            with db_connect() as conn, conn.cursor() as cur:
                cur.execute("SELECT value FROM game_settings WHERE key = 'global'")
                row = cur.fetchone()
                game_config = sanitize_game_config(row[0] if row else DEFAULT_GAME_CONFIG)
        else:
            raw = json.loads(SETTINGS_FILE.read_text(encoding="utf-8")) if SETTINGS_FILE.exists() else DEFAULT_GAME_CONFIG
            game_config = sanitize_game_config(raw)
    except Exception as exc:
        print(f"Nie udało się wczytać ustawień gry: {exc}")
        game_config = dict(DEFAULT_GAME_CONFIG)


def save_game_config(value: Any) -> dict[str, Any]:
    global game_config
    cleaned = sanitize_game_config(value)
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO game_settings (key, value, revision, updated_at)
                VALUES ('global', %s::jsonb, 1, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, revision = game_settings.revision + 1, updated_at = NOW()
                """,
                (json.dumps(cleaned, ensure_ascii=False),),
            )
    else:
        SETTINGS_FILE.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding="utf-8")
    game_config = cleaned
    return public_game_config()


def profile_full_row(row: dict[str, Any]) -> dict[str, Any]:
    upgrades = row.get("upgrades") if isinstance(row.get("upgrades"), dict) else {}
    data = row.get("data", row.get("profile_data", {}))
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except Exception:
            data = {}
    return {
        "id": clean_id(row.get("id") or row.get("player_id")),
        "name": clean_name(row.get("name")),
        "points": clean_number(row.get("points")),
        "trophies": clean_number(row.get("trophies")),
        "coins": clean_number(row.get("coins")),
        "upgrades": {
            "move": clamp_int(upgrades.get("move", row.get("move_level")), 0, 5, 0),
            "fire": clamp_int(upgrades.get("fire", row.get("fire_level")), 0, 5, 0),
            "hp": clamp_int(upgrades.get("hp", row.get("hp_level")), 0, 5, 0),
        },
        "skin": clean_skin(row.get("skin")),
        "cosmicOwned": bool(row.get("cosmic_owned", row.get("cosmicOwned", False))),
        "heroVersion1": bool(row.get("hero_version1", row.get("heroVersion1", False))),
        "adminRevision": clean_number(row.get("admin_revision", row.get("adminRevision", 0))),
        "revision": clean_revision(row.get("revision", 0)),
        "dataVersion": clamp_int(row.get("data_version", row.get("dataVersion", PROFILE_DATA_VERSION)), 1, 9999, PROFILE_DATA_VERSION),
        "data": clean_profile_data(data),
    }


def profile_from_db_row(row: Any) -> dict[str, Any] | None:
    if not row:
        return None
    return profile_full_row({
        "id": row[0], "name": row[1], "points": row[2], "trophies": row[3], "coins": row[4],
        "move_level": row[5], "fire_level": row[6], "hp_level": row[7], "skin": row[8],
        "cosmic_owned": row[9], "hero_version1": row[10], "admin_revision": row[11],
        "revision": row[12], "data_version": row[13], "profile_data": row[14],
    })


def db_get_profile(player_id: str) -> dict[str, Any] | None:
    player_id = clean_id(player_id)
    if not player_id:
        return None
    if not DATABASE_URL:
        return profile_full_row(profiles.get(player_id, {})) if player_id in profiles else None
    with db_connect() as conn, conn.cursor() as cur:
        cur.execute(
            """SELECT player_id,name,points,trophies,coins,move_level,fire_level,hp_level,skin,cosmic_owned,hero_version1,admin_revision,revision,data_version,profile_data
               FROM players WHERE player_id=%s""",
            (player_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    return profile_full_row({
        "id":row[0],"name":row[1],"points":row[2],"trophies":row[3],"coins":row[4],
        "move_level":row[5],"fire_level":row[6],"hp_level":row[7],"skin":row[8],
        "cosmic_owned":row[9],"hero_version1":row[10],"admin_revision":row[11],
        "revision":row[12],"data_version":row[13],"profile_data":row[14],
    })


def db_config_revision() -> int:
    if not DATABASE_URL:
        return 0
    with db_connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT revision FROM game_settings WHERE key='global'")
        row = cur.fetchone()
    return clean_revision(row[0] if row else 0)


def db_schema_status() -> dict[str, Any]:
    if not DATABASE_URL:
        return {"schemaVersion": 0, "storage": "json"}
    with db_connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT COALESCE(MAX(version),0) FROM schema_migrations")
        version = int(cur.fetchone()[0])
        cur.execute("SELECT COUNT(*) FROM players")
        players_count = int(cur.fetchone()[0])
        cur.execute("SELECT COUNT(*) FROM accounts")
        accounts_count = int(cur.fetchone()[0])
    return {"schemaVersion": version, "storage": "postgres", "players": players_count, "accounts": accounts_count}


def admin_secret_equal(provided: Any, expected: str) -> bool:
    if not expected:
        return False
    left = str(provided or "").strip().casefold().encode("utf-8")
    right = expected.strip().casefold().encode("utf-8")
    return hmac.compare_digest(left, right)


def cleanup_admin_sessions() -> None:
    current = now()
    for token, session in list(admin_sessions.items()):
        if float(session.get("expires", 0)) <= current:
            admin_sessions.pop(token, None)


def create_admin_session(player_id: str) -> str:
    cleanup_admin_sessions()
    token = secrets.token_urlsafe(32)
    admin_sessions[token] = {"playerId": player_id, "expires": now() + ADMIN_SESSION_TTL}
    return token


def verify_admin_session(token: str) -> dict[str, Any] | None:
    cleanup_admin_sessions()
    session = admin_sessions.get(token)
    if not session:
        return None
    session["expires"] = now() + ADMIN_SESSION_TTL
    return session


def admin_account_allowed(player_id: str) -> bool:
    required = clean_id(ADMIN_PLAYER_ID)
    return not required or clean_id(player_id) == required


def admin_login_locked(ip: str) -> float:
    row = admin_login_attempts.get(ip) or {}
    until = float(row.get("locked_until", 0))
    return max(0.0, until - now())


def record_admin_login_failure(ip: str) -> None:
    current = now()
    row = admin_login_attempts.get(ip) or {"count": 0, "first": current, "locked_until": 0}
    if current - float(row.get("first", current)) > 600:
        row = {"count": 0, "first": current, "locked_until": 0}
    row["count"] = int(row.get("count", 0)) + 1
    if int(row["count"]) >= 5:
        row["locked_until"] = current + 300
        row["count"] = 0
        row["first"] = current
    admin_login_attempts[ip] = row


def github_api(method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    if not GITHUB_TOKEN or not GITHUB_REPO:
        raise RuntimeError("Brak GITHUB_TOKEN lub GITHUB_REPO w ustawieniach Rendera.")
    url = f"https://api.github.com{path}"
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(url, data=body, method=method)
    request.add_header("Accept", "application/vnd.github+json")
    request.add_header("Authorization", f"Bearer {GITHUB_TOKEN}")
    request.add_header("X-GitHub-Api-Version", "2022-11-28")
    request.add_header("User-Agent", "Arena-Stars-Admin")
    if body is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            raw = response.read()
            return json.loads(raw.decode("utf-8")) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:500]
        raise RuntimeError(f"GitHub API HTTP {exc.code}: {detail}") from exc


def decode_admin_files(files: Any) -> list[tuple[str, bytes]]:
    if not isinstance(files, list) or not files:
        raise ValueError("Nie wybrano plików.")
    decoded: list[tuple[str, bytes]] = []
    total = 0
    for item in files[:12]:
        if not isinstance(item, dict):
            continue
        name = Path(str(item.get("name") or "")).name
        if name not in ADMIN_ALLOWED_FILES:
            raise ValueError(f"Plik {name or '?'} nie jest dozwolony.")
        try:
            content = base64.b64decode(str(item.get("content") or ""), validate=True)
        except Exception as exc:
            raise ValueError(f"Nieprawidłowa zawartość pliku {name}.") from exc
        if len(content) > 4 * 1024 * 1024:
            raise ValueError(f"Plik {name} jest większy niż 4 MB.")
        total += len(content)
        if total > 16 * 1024 * 1024:
            raise ValueError("Łączny rozmiar plików przekracza 16 MB.")
        decoded.append((name, content))
    if not decoded:
        raise ValueError("Nie znaleziono dozwolonych plików.")
    return decoded


def decode_admin_zip(archive: Any) -> list[tuple[str, bytes]]:
    if not isinstance(archive, dict):
        raise ValueError("Nie wybrano archiwum ZIP.")
    name = Path(str(archive.get("name") or "aktualizacja.zip")).name
    if not name.lower().endswith(".zip"):
        raise ValueError("Wybrany plik nie jest archiwum ZIP.")
    try:
        raw = base64.b64decode(str(archive.get("content") or ""), validate=True)
    except Exception as exc:
        raise ValueError("Nieprawidłowa zawartość ZIP-a.") from exc
    if len(raw) > ADMIN_UPLOAD_MAX_RAW:
        raise ValueError("ZIP jest większy niż 40 MB.")
    selected: dict[str, bytes] = {}
    total_unpacked = 0
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as bundle:
            infos = bundle.infolist()
            if len(infos) > 250:
                raise ValueError("ZIP zawiera zbyt wiele plików.")
            for info in infos:
                if info.is_dir():
                    continue
                normalized = info.filename.replace("\\", "/")
                parts = [part for part in normalized.split("/") if part not in {"", "."}]
                if normalized.startswith("/") or any(part == ".." for part in parts):
                    raise ValueError("ZIP zawiera niebezpieczną ścieżkę.")
                if info.flag_bits & 0x1:
                    raise ValueError("Zaszyfrowane ZIP-y nie są obsługiwane.")
                unix_mode = (info.external_attr >> 16) & 0xFFFF
                if unix_mode and stat.S_ISLNK(unix_mode):
                    raise ValueError("ZIP nie może zawierać dowiązań symbolicznych.")
                basename = parts[-1] if parts else ""
                if basename not in ADMIN_ALLOWED_FILES:
                    continue
                if basename in selected:
                    raise ValueError(f"ZIP zawiera więcej niż jeden plik {basename}.")
                if info.file_size > 10 * 1024 * 1024:
                    raise ValueError(f"Plik {basename} w ZIP-ie jest większy niż 10 MB.")
                total_unpacked += info.file_size
                if total_unpacked > 60 * 1024 * 1024:
                    raise ValueError("Rozpakowane pliki przekraczają 60 MB.")
                selected[basename] = bundle.read(info)
    except zipfile.BadZipFile as exc:
        raise ValueError("Archiwum ZIP jest uszkodzone.") from exc
    if not selected:
        raise ValueError("ZIP nie zawiera dozwolonych plików gry.")
    return list(selected.items())


def validate_update_bundle(decoded: list[tuple[str, bytes]]) -> list[tuple[str, bytes]]:
    names = {name for name, _ in decoded}
    required = {"index.html", "game.js", "server.py"}
    missing = sorted(required - names)
    if missing:
        raise ValueError("ZIP nie jest pełną aktualizacją. Brakuje: " + ", ".join(missing))
    return decoded

def decode_admin_zip_bytes(raw: bytes, name: str = "aktualizacja.zip") -> list[tuple[str, bytes]]:
    if not name.lower().endswith(".zip"):
        raise ValueError("Wybrany plik nie jest archiwum ZIP.")
    if not raw:
        raise ValueError("ZIP jest pusty.")
    if len(raw) > ADMIN_UPLOAD_MAX_RAW:
        raise ValueError("ZIP jest większy niż 40 MB.")
    archive = {"name": name, "content": base64.b64encode(raw).decode("ascii")}
    return validate_update_bundle(decode_admin_zip(archive))

def deploy_decoded_to_github(decoded: list[tuple[str, bytes]], message: str, source_type: str) -> dict[str, Any]:
    decoded = validate_update_bundle(decoded)
    repo = GITHUB_REPO.strip("/")
    branch = GITHUB_BRANCH
    ref = github_api("GET", f"/repos/{repo}/git/ref/heads/{branch}")
    parent_sha = str(ref.get("object", {}).get("sha") or "")
    if not parent_sha:
        raise RuntimeError("Nie udało się odczytać gałęzi GitHub.")
    parent_commit = github_api("GET", f"/repos/{repo}/git/commits/{parent_sha}")
    base_tree = str(parent_commit.get("tree", {}).get("sha") or "")
    tree_entries = []
    for name, content in decoded:
        blob = github_api("POST", f"/repos/{repo}/git/blobs", {"content": base64.b64encode(content).decode("ascii"), "encoding": "base64"})
        tree_entries.append({"path": name, "mode": "100644", "type": "blob", "sha": blob["sha"]})
    tree = github_api("POST", f"/repos/{repo}/git/trees", {"base_tree": base_tree, "tree": tree_entries})
    commit = github_api("POST", f"/repos/{repo}/git/commits", {"message": clean_mode_text(message, 100) or "Aktualizacja z panelu administratora", "tree": tree["sha"], "parents": [parent_sha]})
    github_api("PATCH", f"/repos/{repo}/git/refs/heads/{branch}", {"sha": commit["sha"], "force": False})
    if RENDER_DEPLOY_HOOK:
        try:
            urllib.request.urlopen(urllib.request.Request(RENDER_DEPLOY_HOOK, data=b"", method="POST"), timeout=10).read()
        except Exception as exc:
            print(f"Commit zapisany, ale deploy hook nie odpowiedział: {exc}")
    return {"ok": True, "commit": commit.get("sha"), "files": [name for name, _ in decoded], "repo": repo, "branch": branch, "source": source_type}

def deploy_files_to_github(files: Any, archive: Any, message: str) -> dict[str, Any]:
    if archive:
        decoded = decode_admin_zip(archive)
        source_type = "zip-json"
    else:
        decoded = decode_admin_files(files)
        source_type = "files-json"
    return deploy_decoded_to_github(decoded, message, source_type)


# ----------------------------- konta, sesje, bany i czat -----------------------------

def normalize_username(value: Any) -> tuple[str, str]:
    username = " ".join(str(value or "").strip().split())
    if not 3 <= len(username) <= 20:
        raise ValueError("Nazwa konta musi mieć od 3 do 20 znaków.")
    if not all(ch.isalnum() or ch in "_-." for ch in username):
        raise ValueError("Nazwa konta może zawierać litery, cyfry, _, - i kropkę.")
    return username, username.casefold()


def validate_password(value: Any) -> str:
    password = str(value or "")
    if len(password) < 6:
        raise ValueError("Hasło musi mieć co najmniej 6 znaków.")
    if len(password) > 128:
        raise ValueError("Hasło jest za długie.")
    return password


EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,189}\.[^@\s]{2,63}$")


def normalize_email(value: Any) -> tuple[str, str]:
    email = str(value or "").strip()
    if len(email) > 254 or not EMAIL_RE.fullmatch(email):
        raise ValueError("Wpisz prawidłowy adres e-mail.")
    return email, email.casefold()


def mask_email(value: Any) -> str:
    email = str(value or "").strip()
    if "@" not in email:
        return ""
    local, domain = email.split("@", 1)
    visible = local[:1]
    return f"{visible}{'*' * max(2, min(6, len(local)-1))}@{domain}"


def reset_rate_allowed(key: str) -> bool:
    current = now()
    cutoff = current - PASSWORD_RESET_RATE_WINDOW
    attempts = [stamp for stamp in password_reset_attempts.get(key, []) if stamp >= cutoff]
    if len(attempts) >= PASSWORD_RESET_RATE_MAX:
        password_reset_attempts[key] = attempts
        return False
    attempts.append(current)
    password_reset_attempts[key] = attempts
    return True


def build_public_url(request_host: str = "", forwarded_proto: str = "") -> str:
    if APP_PUBLIC_URL:
        return APP_PUBLIC_URL
    render_host = os.environ.get("RENDER_EXTERNAL_HOSTNAME", "").strip()
    if render_host:
        return f"https://{render_host}"
    host = request_host.strip() or f"127.0.0.1:{PORT}"
    proto = forwarded_proto.strip() or ("https" if os.environ.get("RENDER") else "http")
    return f"{proto}://{host}"


def send_password_reset_email(email: str, username: str, reset_url: str) -> None:
    if not RESEND_API_KEY or not PASSWORD_RESET_FROM:
        raise RuntimeError("Wysyłanie e-maili nie jest skonfigurowane.")
    safe_user = html_lib.escape(username)
    safe_url = html_lib.escape(reset_url, quote=True)
    payload = {
        "from": PASSWORD_RESET_FROM,
        "to": [email],
        "subject": "Arena Stars 3D — reset hasła",
        "html": (
            f"<div style='font-family:Arial,sans-serif;line-height:1.55;color:#111'>"
            f"<h2>Reset hasła Arena Stars 3D</h2>"
            f"<p>Cześć <b>{safe_user}</b>.</p>"
            f"<p>Kliknij poniższy przycisk, aby ustawić nowe hasło. Link jest ważny przez 30 minut i działa tylko raz.</p>"
            f"<p><a href='{safe_url}' style='display:inline-block;padding:12px 18px;background:#397dff;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold'>USTAW NOWE HASŁO</a></p>"
            f"<p>Jeśli to nie Ty prosiłeś o zmianę hasła, zignoruj tę wiadomość.</p>"
            f"</div>"
        ),
        "text": (
            f"Cześć {username}. Ustaw nowe hasło do Arena Stars 3D: {reset_url}\n"
            "Link jest ważny przez 30 minut i działa tylko raz."
        ),
    }
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "Arena-Stars-3D/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            if not 200 <= int(response.status) < 300:
                raise RuntimeError(f"Usługa e-mail zwróciła kod {response.status}.")
    except urllib.error.HTTPError as exc:
        detail = exc.read(800).decode("utf-8", "replace")
        print(f"Błąd Resend: HTTP {exc.code}: {detail}")
        raise RuntimeError("Nie udało się wysłać e-maila resetującego.") from exc
    except Exception as exc:
        print(f"Błąd wysyłania e-maila: {type(exc).__name__}: {exc}")
        raise RuntimeError("Nie udało się wysłać e-maila resetującego.") from exc


def make_password_hash(password: str, salt_b64: str | None = None) -> tuple[str, str]:
    salt = base64.b64decode(salt_b64) if salt_b64 else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 240_000)
    return base64.b64encode(digest).decode("ascii"), base64.b64encode(salt).decode("ascii")


def verify_password(password: str, expected_hash: str, salt_b64: str) -> bool:
    calculated, _ = make_password_hash(password, salt_b64)
    return hmac.compare_digest(calculated, expected_hash)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def account_ban_payload(row: dict[str, Any]) -> dict[str, Any]:
    until = float(row.get("banned_until_ts") or 0)
    active = until > now()
    return {"banned": active, "bannedUntil": until if active else 0, "banReason": str(row.get("ban_reason") or "") if active else ""}


def account_public(row: dict[str, Any]) -> dict[str, Any]:
    ban = account_ban_payload(row)
    account_id = clean_id(row.get("account_id") or row.get("id"))
    return {
        "id": account_id,
        "playerId": account_id,
        "username": str(row.get("username") or ""),
        "emailRequired": not bool(str(row.get("email") or "").strip()),
        "emailMasked": mask_email(row.get("email")),
        # Flaga jest wyliczana wyłącznie na serwerze. Tylko konto właściciela
        # otrzymuje ceny 0 w sklepie klienta.
        "ownerBenefits": bool(account_id and account_id == clean_id(ADMIN_PLAYER_ID)),
        "banCount": clean_number(row.get("ban_count", row.get("banCount", 0))),
        **ban,
    }


def load_account_storage() -> None:
    global local_accounts, local_chat_messages, local_chat_seq
    if DATABASE_URL:
        return
    try:
        raw = json.loads(ACCOUNTS_FILE.read_text(encoding="utf-8")) if ACCOUNTS_FILE.exists() else {}
        local_accounts = raw if isinstance(raw, dict) else {}
    except Exception:
        local_accounts = {}
    try:
        raw_chat = json.loads(CHAT_FILE.read_text(encoding="utf-8")) if CHAT_FILE.exists() else []
        local_chat_messages = raw_chat if isinstance(raw_chat, list) else []
        local_chat_seq = max([clean_number(m.get("id")) for m in local_chat_messages] or [0])
    except Exception:
        local_chat_messages, local_chat_seq = [], 0


def save_account_storage() -> None:
    if DATABASE_URL:
        return
    ACCOUNTS_FILE.write_text(json.dumps(local_accounts, ensure_ascii=False, indent=2), encoding="utf-8")
    CHAT_FILE.write_text(json.dumps(local_chat_messages[-3000:], ensure_ascii=False, indent=2), encoding="utf-8")


def account_get_by_username(username_key: str) -> dict[str, Any] | None:
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT account_id, username, password_hash, password_salt, EXTRACT(EPOCH FROM banned_until), ban_reason, ban_count, email, email_key FROM accounts WHERE username_key=%s", (username_key,))
            row = cur.fetchone()
        return ({"account_id":row[0],"username":row[1],"password_hash":row[2],"password_salt":row[3],"banned_until_ts":float(row[4] or 0),"ban_reason":row[5] or "","ban_count":clean_number(row[6]),"email":row[7] or "","email_key":row[8] or ""} if row else None)
    for row in local_accounts.values():
        if str(row.get("username_key")) == username_key:
            return dict(row)
    return None


def account_get(account_id: str) -> dict[str, Any] | None:
    account_id = clean_id(account_id)
    if not account_id:
        return None
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT account_id, username, password_hash, password_salt, EXTRACT(EPOCH FROM banned_until), ban_reason, ban_count, email, email_key FROM accounts WHERE account_id=%s", (account_id,))
            row = cur.fetchone()
        return ({"account_id":row[0],"username":row[1],"password_hash":row[2],"password_salt":row[3],"banned_until_ts":float(row[4] or 0),"ban_reason":row[5] or "","ban_count":clean_number(row[6]),"email":row[7] or "","email_key":row[8] or ""} if row else None)
    row = local_accounts.get(account_id)
    return dict(row) if row else None



def account_get_by_email(email_key: str) -> dict[str, Any] | None:
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT account_id, username, password_hash, password_salt, EXTRACT(EPOCH FROM banned_until), ban_reason, ban_count, email, email_key FROM accounts WHERE email_key=%s",
                (email_key,),
            )
            row = cur.fetchone()
        return ({"account_id":row[0],"username":row[1],"password_hash":row[2],"password_salt":row[3],"banned_until_ts":float(row[4] or 0),"ban_reason":row[5] or "","ban_count":clean_number(row[6]),"email":row[7] or "","email_key":row[8] or ""} if row else None)
    for row in local_accounts.values():
        if str(row.get("email_key") or "") == email_key:
            return dict(row)
    return None


def account_set_email(account_id: str, email_value: Any) -> dict[str, Any]:
    email, email_key = normalize_email(email_value)
    current = account_get(account_id)
    if not current:
        raise ValueError("Nie znaleziono konta.")
    if str(current.get("email") or "").strip():
        raise ValueError("Adres e-mail jest już przypisany do tego konta.")
    other = account_get_by_email(email_key)
    if other and clean_id(other.get("account_id")) != clean_id(account_id):
        raise ValueError("Ten adres e-mail jest już używany przez inne konto.")
    if DATABASE_URL:
        try:
            with db_connect() as conn, conn.cursor() as cur:
                cur.execute("UPDATE accounts SET email=%s,email_key=%s WHERE account_id=%s", (email,email_key,account_id))
        except Exception as exc:
            if "unique" in str(exc).lower():
                raise ValueError("Ten adres e-mail jest już używany przez inne konto.") from exc
            raise
    else:
        local_accounts[account_id]["email"] = email
        local_accounts[account_id]["email_key"] = email_key
        save_account_storage()
    return account_get(account_id) or current


def create_password_reset(email_value: Any, base_url: str, request_key: str) -> None:
    email, email_key = normalize_email(email_value)
    if not reset_rate_allowed(f"ip:{request_key}") or not reset_rate_allowed(f"email:{email_key}"):
        raise RuntimeError("Za dużo prób resetowania. Spróbuj ponownie za około 15 minut.")
    account = account_get_by_email(email_key)
    if not account:
        return
    if not RESEND_API_KEY or not PASSWORD_RESET_FROM:
        raise RuntimeError("Reset hasła przez e-mail nie jest jeszcze skonfigurowany.")
    token = secrets.token_urlsafe(40)
    digest = token_hash(token)
    expiry = now() + PASSWORD_RESET_TTL
    account_id = clean_id(account.get("account_id"))
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM password_reset_tokens WHERE expires_at<NOW() OR used_at IS NOT NULL")
            cur.execute("DELETE FROM password_reset_tokens WHERE account_id=%s", (account_id,))
            cur.execute(
                "INSERT INTO password_reset_tokens (token_hash,account_id,expires_at) VALUES (%s,%s,TO_TIMESTAMP(%s))",
                (digest,account_id,expiry),
            )
    else:
        for key, row in list(local_password_reset_tokens.items()):
            if row.get("account_id") == account_id or float(row.get("expires",0)) <= now():
                local_password_reset_tokens.pop(key, None)
        local_password_reset_tokens[digest] = {"account_id":account_id,"expires":expiry,"used":False}
    reset_url = f"{base_url.rstrip('/')}/?reset_token={quote(token)}"
    send_password_reset_email(str(account.get("email") or email), str(account.get("username") or "Gracz"), reset_url)


def reset_account_password(token_value: Any, password_value: Any, repeat_value: Any) -> dict[str, Any]:
    token = str(token_value or "").strip()
    if len(token) < 20:
        raise ValueError("Link resetujący jest nieprawidłowy.")
    password = validate_password(password_value)
    if password != str(repeat_value or ""):
        raise ValueError("Podane hasła nie są takie same.")
    digest = token_hash(token)
    account_id = ""
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT account_id FROM password_reset_tokens WHERE token_hash=%s AND used_at IS NULL AND expires_at>NOW()",
                (digest,),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError("Link resetujący wygasł albo został już użyty.")
            account_id = clean_id(row[0])
            password_hash, password_salt = make_password_hash(password)
            cur.execute("UPDATE accounts SET password_hash=%s,password_salt=%s WHERE account_id=%s", (password_hash,password_salt,account_id))
            cur.execute("UPDATE password_reset_tokens SET used_at=NOW() WHERE token_hash=%s", (digest,))
            cur.execute("DELETE FROM account_sessions WHERE account_id=%s", (account_id,))
    else:
        row = local_password_reset_tokens.get(digest)
        if not row or row.get("used") or float(row.get("expires",0)) <= now():
            raise ValueError("Link resetujący wygasł albo został już użyty.")
        account_id = clean_id(row.get("account_id"))
        password_hash, password_salt = make_password_hash(password)
        local_accounts[account_id]["password_hash"] = password_hash
        local_accounts[account_id]["password_salt"] = password_salt
        row["used"] = True
        for key, session in list(local_auth_sessions.items()):
            if clean_id(session.get("account_id")) == account_id:
                local_auth_sessions.pop(key, None)
        save_account_storage()
    for key, session in list(admin_sessions.items()):
        if clean_id(session.get("playerId")) == account_id:
            admin_sessions.pop(key, None)
    return account_get(account_id) or {"account_id":account_id}



def ensure_account_profile(account_id: str, username: str) -> None:
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1 FROM players WHERE player_id=%s", (account_id,))
            if not cur.fetchone():
                cur.execute("INSERT INTO players (player_id,name,points,trophies,updated_at) VALUES (%s,%s,0,0,NOW())", (account_id, clean_name(username)))
            else:
                cur.execute("UPDATE players SET name=%s, updated_at=NOW() WHERE player_id=%s", (clean_name(username), account_id))
    else:
        row = profiles.get(account_id) or {"id":account_id,"points":0,"trophies":0,"coins":0,"upgrades":{"move":0,"fire":0,"hp":0},"skin":"classic","cosmicOwned":False,"heroVersion1":False,"adminRevision":0}
        row["name"] = clean_name(username)
        profiles[account_id] = row
        save_profiles()


def account_create(username_value: Any, email_value: Any, password_value: Any, requested_id: Any) -> dict[str, Any]:
    username, username_key = normalize_username(username_value)
    email, email_key = normalize_email(email_value)
    password = validate_password(password_value)
    if account_get_by_username(username_key):
        raise ValueError("Ta nazwa konta jest już zajęta.")
    if account_get_by_email(email_key):
        raise ValueError("Ten adres e-mail jest już używany przez inne konto.")
    account_id = clean_id(requested_id) or str(uuid.uuid4())
    if account_get(account_id):
        account_id = str(uuid.uuid4())
    password_hash, password_salt = make_password_hash(password)
    if DATABASE_URL:
        try:
            with db_connect() as conn, conn.cursor() as cur:
                cur.execute("INSERT INTO accounts (account_id,username,username_key,email,email_key,password_hash,password_salt,last_login) VALUES (%s,%s,%s,%s,%s,%s,%s,NOW())", (account_id,username,username_key,email,email_key,password_hash,password_salt))
        except Exception as exc:
            if "unique" in str(exc).lower():
                raise ValueError("Ta nazwa konta jest już zajęta.") from exc
            raise
    else:
        local_accounts[account_id] = {"account_id":account_id,"username":username,"username_key":username_key,"email":email,"email_key":email_key,"password_hash":password_hash,"password_salt":password_salt,"banned_until_ts":0,"ban_reason":"","ban_count":0,"created_at":now(),"last_login":now()}
        save_account_storage()
    ensure_account_profile(account_id, username)
    return account_get(account_id) or {"account_id":account_id,"username":username}


def account_mark_login(account_id: str) -> None:
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute("UPDATE accounts SET last_login=NOW() WHERE account_id=%s", (account_id,))
    elif account_id in local_accounts:
        local_accounts[account_id]["last_login"] = now(); save_account_storage()


def create_account_session(account_id: str) -> str:
    token = secrets.token_urlsafe(36)
    digest = token_hash(token)
    expiry = now() + AUTH_SESSION_TTL
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM account_sessions WHERE expires_at < NOW()")
            cur.execute("INSERT INTO account_sessions (token_hash,account_id,expires_at) VALUES (%s,%s,TO_TIMESTAMP(%s))", (digest,account_id,expiry))
    else:
        local_auth_sessions[digest] = {"account_id":account_id,"expires":expiry}
    return token


def verify_account_session(token: str) -> dict[str, Any] | None:
    if not token:
        return None
    digest = token_hash(token)
    account_id = ""
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT account_id FROM account_sessions WHERE token_hash=%s AND expires_at>NOW()", (digest,))
            row = cur.fetchone(); account_id = str(row[0]) if row else ""
    else:
        row = local_auth_sessions.get(digest)
        if row and float(row.get("expires",0)) > now(): account_id = str(row.get("account_id") or "")
        elif row: local_auth_sessions.pop(digest,None)
    return account_get(account_id) if account_id else None


def delete_account_session(token: str) -> None:
    if not token: return
    digest = token_hash(token)
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur: cur.execute("DELETE FROM account_sessions WHERE token_hash=%s", (digest,))
    else: local_auth_sessions.pop(digest,None)


def set_account_ban(account_id: str, seconds: float, reason: str) -> dict[str, Any]:
    account_id = clean_id(account_id)
    current = account_get(account_id)
    if not current:
        return account_public({"account_id": account_id, "username": ""})
    previous_count = clean_number(current.get("ban_count", 0), 1000)
    requested_multiplier = 1.5 ** previous_count
    base_seconds = max(60.0, float(seconds))
    effective_seconds = min(10 * 365 * 24 * 3600.0, base_seconds * requested_multiplier)
    multiplier = effective_seconds / base_seconds
    until = now() + effective_seconds
    reason = clean_mode_text(reason, 240) or "Ban administratora"
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE accounts SET banned_until=TO_TIMESTAMP(%s), ban_reason=%s, ban_count=ban_count+1 WHERE account_id=%s",
                (until, reason, account_id),
            )
    elif account_id in local_accounts:
        local_accounts[account_id]["banned_until_ts"] = until
        local_accounts[account_id]["ban_reason"] = reason
        local_accounts[account_id]["ban_count"] = previous_count + 1
        save_account_storage()
    result = account_public(account_get(account_id) or {"account_id": account_id, "username": ""})
    result["baseBanSeconds"] = base_seconds
    result["effectiveBanSeconds"] = effective_seconds
    result["banMultiplier"] = multiplier
    return result


def clear_account_ban(account_id: str) -> dict[str, Any]:
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute("UPDATE accounts SET banned_until=NULL, ban_reason='' WHERE account_id=%s", (account_id,))
    elif account_id in local_accounts:
        local_accounts[account_id]["banned_until_ts"] = 0; local_accounts[account_id]["ban_reason"] = ""; save_account_storage()
    return account_public(account_get(account_id) or {"account_id":account_id,"username":""})


def normalize_for_moderation(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.casefold())
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


PROFANITY_RE = re.compile(r"(?<![a-z0-9])(kurw\w*|chuj\w*|jeb\w*|pierd\w*|skurw\w*|cwel\w*)(?![a-z0-9])", re.IGNORECASE)


def contains_profanity(text: str) -> bool:
    return bool(PROFANITY_RE.search(normalize_for_moderation(text)))


def chat_users(current_id: str, query: str = "") -> list[dict[str, Any]]:
    query_key = query.strip().casefold()
    rows: list[dict[str, Any]] = []
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            if query_key:
                cur.execute("SELECT account_id, username, EXTRACT(EPOCH FROM banned_until), ban_reason FROM accounts WHERE account_id<>%s AND username_key LIKE %s ORDER BY username_key LIMIT 100", (current_id,f"%{query_key}%"))
            else:
                cur.execute("SELECT account_id, username, EXTRACT(EPOCH FROM banned_until), ban_reason FROM accounts WHERE account_id<>%s ORDER BY username_key LIMIT 100", (current_id,))
            raw = cur.fetchall()
            rows = [{"account_id":r[0],"username":r[1],"banned_until_ts":float(r[2] or 0),"ban_reason":r[3] or ""} for r in raw]
    else:
        rows = [dict(r) for aid,r in local_accounts.items() if aid != current_id and (not query_key or query_key in str(r.get("username_key", "")))]
        rows.sort(key=lambda r:str(r.get("username_key","")))
        rows=rows[:100]
    return [{**account_public(r),"online":clean_id(r.get("account_id")) in active_players} for r in rows]


def chat_send(sender: dict[str, Any], recipients_value: Any, body_value: Any, broadcast_value: Any = False) -> dict[str, Any]:
    global local_chat_seq
    body = " ".join(str(body_value or "").strip().split())[:CHAT_MAX_MESSAGE]
    if not body:
        raise ValueError("Wiadomość jest pusta.")
    if contains_profanity(body):
        minutes = float(game_config.get("profanityBanMinutes", 120.0))
        banned = set_account_ban(sender["account_id"], minutes * 60.0, "Automatyczny ban: przeklinanie na czacie")
        return {"banned": True, **banned}

    broadcast = broadcast_value is True or str(broadcast_value).strip().casefold() in {"1", "true", "yes", "tak"}
    batch_id = ("all-" if broadcast else "private-") + secrets.token_hex(12)
    created = now()

    if broadcast:
        if DATABASE_URL:
            with db_connect() as conn, conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO chat_messages (batch_id,sender_id,recipient_id,body,created_at,is_broadcast) VALUES (%s,%s,NULL,%s,TO_TIMESTAMP(%s),TRUE)",
                    (batch_id, sender["account_id"], body, created),
                )
        else:
            local_chat_seq += 1
            local_chat_messages.append({
                "id": local_chat_seq,
                "batch_id": batch_id,
                "sender_id": sender["account_id"],
                "recipient_id": None,
                "body": body,
                "created_at": created,
                "is_broadcast": True,
            })
            save_account_storage()
        return {"ok": True, "batchId": batch_id, "broadcast": True, "recipients": []}

    raw = recipients_value if isinstance(recipients_value, list) else []
    recipients: list[str] = []
    for value in raw:
        rid = clean_id(value)
        if rid and rid != sender["account_id"] and account_get(rid):
            recipients = [rid]
            break
    if not recipients:
        raise ValueError("Wybierz jednego odbiorcę albo przełącz czat na cały serwer.")

    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            for rid in recipients:
                cur.execute(
                    "INSERT INTO chat_messages (batch_id,sender_id,recipient_id,body,created_at,is_broadcast) VALUES (%s,%s,%s,%s,TO_TIMESTAMP(%s),FALSE)",
                    (batch_id, sender["account_id"], rid, body, created),
                )
    else:
        for rid in recipients:
            local_chat_seq += 1
            local_chat_messages.append({
                "id": local_chat_seq,
                "batch_id": batch_id,
                "sender_id": sender["account_id"],
                "recipient_id": rid,
                "body": body,
                "created_at": created,
                "is_broadcast": False,
            })
        save_account_storage()
    return {"ok": True, "batchId": batch_id, "broadcast": False, "recipients": recipients}


def chat_history(account_id: str, limit: int = CHAT_HISTORY_LIMIT) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute(
                """SELECT m.id,m.batch_id,m.sender_id,s.username,m.recipient_id,r.username,m.body,
                          EXTRACT(EPOCH FROM m.created_at),COALESCE(m.is_broadcast,FALSE)
                   FROM chat_messages m
                   JOIN accounts s ON s.account_id=m.sender_id
                   LEFT JOIN accounts r ON r.account_id=m.recipient_id
                   WHERE m.sender_id=%s OR m.recipient_id=%s OR COALESCE(m.is_broadcast,FALSE)=TRUE
                   ORDER BY m.id DESC LIMIT %s""",
                (account_id, account_id, limit * 4),
            )
            records = [{
                "id": x[0], "batch_id": x[1], "sender_id": x[2], "sender_name": x[3],
                "recipient_id": x[4], "recipient_name": x[5] or "", "body": x[6],
                "created_at": float(x[7]), "is_broadcast": bool(x[8]),
            } for x in cur.fetchall()][::-1]
    else:
        name_map = {aid: str(r.get("username") or "") for aid, r in local_accounts.items()}
        for m in local_chat_messages:
            is_broadcast = bool(m.get("is_broadcast")) or str(m.get("batch_id", "")).startswith("all-")
            if is_broadcast or m.get("sender_id") == account_id or m.get("recipient_id") == account_id:
                records.append({
                    **m,
                    "sender_name": name_map.get(m.get("sender_id"), "?"),
                    "recipient_name": name_map.get(m.get("recipient_id"), ""),
                    "is_broadcast": is_broadcast,
                })
        records = records[-limit * 4:]

    grouped: dict[Any, dict[str, Any]] = {}
    order: list[Any] = []
    for m in records:
        key = (m["batch_id"], m["sender_id"], m["body"], int(m["created_at"]))
        if key not in grouped:
            grouped[key] = {
                "id": m["id"], "batchId": m["batch_id"], "senderId": m["sender_id"],
                "sender": m["sender_name"], "recipients": [], "body": m["body"],
                "createdAt": m["created_at"], "broadcast": bool(m.get("is_broadcast")),
            }
            order.append(key)
        if m.get("is_broadcast"):
            grouped[key]["broadcast"] = True
            grouped[key]["recipients"] = [{"id": "*", "username": "WSZYSCY"}]
        elif m.get("recipient_id"):
            grouped[key]["recipients"].append({"id": m["recipient_id"], "username": m["recipient_name"]})
        grouped[key]["id"] = max(grouped[key]["id"], m["id"])
    return [grouped[k] for k in order][-limit:]


def admin_accounts(query: str = "") -> list[dict[str, Any]]:
    query_key=query.strip().casefold()
    rows=[]
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute("""SELECT a.account_id,a.username,EXTRACT(EPOCH FROM a.banned_until),a.ban_reason,p.points,p.trophies,p.coins,a.ban_count
                           FROM accounts a LEFT JOIN players p ON p.player_id=a.account_id
                           WHERE (%s='' OR a.username_key LIKE %s OR a.account_id LIKE %s)
                           ORDER BY a.username_key LIMIT 100""", (query_key,f"%{query_key}%",f"%{query_key}%"))
            rows=cur.fetchall()
    else:
        for aid,a in local_accounts.items():
            if query_key and query_key not in str(a.get("username_key","")) and query_key not in aid.casefold(): continue
            p=profiles.get(aid,{})
            rows.append((aid,a.get("username"),a.get("banned_until_ts",0),a.get("ban_reason",""),p.get("points",0),p.get("trophies",0),p.get("coins",0),a.get("ban_count",0)))
    return [{**account_public({"account_id":r[0],"username":r[1],"banned_until_ts":float(r[2] or 0),"ban_reason":r[3] or "","ban_count":clean_number(r[7])}),"points":clean_number(r[4]),"trophies":clean_number(r[5]),"coins":clean_number(r[6])} for r in rows]


# ----------------------------- Neon Postgres -----------------------------

_db_pool = None

def init_db_pool() -> None:
    global _db_pool
    if not DATABASE_URL or _db_pool is not None:
        return
    try:
        from psycopg_pool import ConnectionPool  # type: ignore
    except ImportError:
        _db_pool = None
        return
    max_size = max(2, min(8, int(os.environ.get("DB_POOL_MAX", "5"))))
    _db_pool = ConnectionPool(
        conninfo=DATABASE_URL, min_size=1, max_size=max_size, timeout=12,
        kwargs={"autocommit": True, "connect_timeout": 10}, open=True,
    )
    _db_pool.wait(timeout=15)

def close_db_pool() -> None:
    global _db_pool
    if _db_pool is not None:
        try:
            _db_pool.close()
        finally:
            _db_pool = None

def db_connect():
    try:
        import psycopg  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "Brakuje pakietu psycopg. Wgraj requirements.txt i przebuduj usługę."
        ) from exc
    if _db_pool is not None:
        return _db_pool.connection()
    return psycopg.connect(DATABASE_URL, autocommit=True, connect_timeout=10)


def init_database() -> None:
    if not DATABASE_URL:
        return
    with db_connect() as conn, conn.cursor() as cur:
        cur.execute(
            """CREATE TABLE IF NOT EXISTS schema_migrations (
                   version INTEGER PRIMARY KEY,
                   description TEXT NOT NULL,
                   applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
               )"""
        )
        cur.execute(
            """CREATE TABLE IF NOT EXISTS server_state (
                   key TEXT PRIMARY KEY,
                   value JSONB NOT NULL DEFAULT '{}'::jsonb,
                   revision BIGINT NOT NULL DEFAULT 1,
                   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
               )"""
        )
        cur.execute(
            """CREATE TABLE IF NOT EXISTS players (
                player_id VARCHAR(80) PRIMARY KEY,
                name VARCHAR(18) NOT NULL,
                points BIGINT NOT NULL DEFAULT 0 CHECK (points >= 0),
                trophies BIGINT NOT NULL DEFAULT 0 CHECK (trophies >= 0),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )"""
        )
        for statement in (
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS coins BIGINT NOT NULL DEFAULT 0",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS move_level INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS fire_level INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS hp_level INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS skin VARCHAR(16) NOT NULL DEFAULT 'classic'",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS cosmic_owned BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS hero_version1 BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS admin_revision BIGINT NOT NULL DEFAULT 0",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS data_version INTEGER NOT NULL DEFAULT 1",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS profile_data JSONB NOT NULL DEFAULT '{}'::jsonb",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS last_client_version VARCHAR(40) NOT NULL DEFAULT ''",
            "ALTER TABLE players ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ",
        ):
            cur.execute(statement)
        cur.execute("CREATE TABLE IF NOT EXISTS game_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())")
        cur.execute("ALTER TABLE game_settings ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1")
        cur.execute(
            """CREATE TABLE IF NOT EXISTS accounts (
                account_id VARCHAR(80) PRIMARY KEY,
                username VARCHAR(24) NOT NULL,
                username_key VARCHAR(24) NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_login TIMESTAMPTZ,
                banned_until TIMESTAMPTZ,
                ban_reason VARCHAR(240) NOT NULL DEFAULT '',
                ban_count INTEGER NOT NULL DEFAULT 0
            )"""
        )
        cur.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ban_count INTEGER NOT NULL DEFAULT 0")
        cur.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email VARCHAR(254)")
        cur.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_key VARCHAR(254)")
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_key_unique ON accounts (email_key) WHERE email_key IS NOT NULL")
        cur.execute(
            """CREATE TABLE IF NOT EXISTS account_sessions (
                token_hash CHAR(64) PRIMARY KEY,
                account_id VARCHAR(80) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL
            )"""
        )
        cur.execute(
            """CREATE TABLE IF NOT EXISTS password_reset_tokens (
                token_hash CHAR(64) PRIMARY KEY,
                account_id VARCHAR(80) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL,
                used_at TIMESTAMPTZ
            )"""
        )
        cur.execute("CREATE INDEX IF NOT EXISTS password_reset_expiry_idx ON password_reset_tokens (expires_at)")
        cur.execute(
            """CREATE TABLE IF NOT EXISTS chat_messages (
                id BIGSERIAL PRIMARY KEY,
                batch_id VARCHAR(64) NOT NULL,
                sender_id VARCHAR(80) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
                recipient_id VARCHAR(80) REFERENCES accounts(account_id) ON DELETE CASCADE,
                body VARCHAR(300) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                is_broadcast BOOLEAN NOT NULL DEFAULT FALSE
            )"""
        )
        cur.execute("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_broadcast BOOLEAN NOT NULL DEFAULT FALSE")
        cur.execute("ALTER TABLE chat_messages ALTER COLUMN recipient_id DROP NOT NULL")
        cur.execute(
            """CREATE TABLE IF NOT EXISTS match_results (
                id BIGSERIAL PRIMARY KEY,
                account_id VARCHAR(80) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
                mode VARCHAR(32) NOT NULL,
                result VARCHAR(24) NOT NULL,
                points_delta BIGINT NOT NULL DEFAULT 0,
                trophies_delta BIGINT NOT NULL DEFAULT 0,
                coins_delta BIGINT NOT NULL DEFAULT 0,
                duration_seconds NUMERIC(12,3) NOT NULL DEFAULT 0,
                details JSONB NOT NULL DEFAULT '{}'::jsonb,
                client_version VARCHAR(40) NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )"""
        )
        cur.execute(
            """CREATE TABLE IF NOT EXISTS data_audit (
                id BIGSERIAL PRIMARY KEY,
                account_id VARCHAR(80),
                event_type VARCHAR(48) NOT NULL,
                payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )"""
        )
        cur.execute("CREATE INDEX IF NOT EXISTS players_ranking_idx ON players (points DESC, trophies DESC, player_id ASC)")
        cur.execute("CREATE INDEX IF NOT EXISTS players_updated_idx ON players (updated_at DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS account_sessions_expiry_idx ON account_sessions (expires_at)")
        cur.execute("CREATE INDEX IF NOT EXISTS chat_messages_users_idx ON chat_messages (sender_id, recipient_id, id DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS chat_messages_created_idx ON chat_messages (created_at DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS match_results_account_idx ON match_results (account_id, created_at DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS data_audit_account_idx ON data_audit (account_id, created_at DESC)")
        cur.execute(
            "INSERT INTO schema_migrations(version,description) VALUES (%s,%s) ON CONFLICT(version) DO NOTHING",
            (DB_SCHEMA_VERSION, "Adresy e-mail kont i jednorazowe resetowanie hasła przez e-mail"),
        )
        cur.execute(
            """INSERT INTO server_state(key,value,revision,updated_at)
               VALUES ('database', %s::jsonb, 1, NOW())
               ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, revision=server_state.revision+1, updated_at=NOW()""",
            (json.dumps({"schemaVersion": DB_SCHEMA_VERSION, "profileDataVersion": PROFILE_DATA_VERSION}, ensure_ascii=False),),
        )


def db_upsert_profile(payload: dict[str, Any]) -> dict[str, Any] | None:
    player_id = clean_id(payload.get("playerId"))
    if not player_id:
        return None
    incoming_data = clean_profile_data(payload.get("data"))
    incoming = profile_full_row({
        "id": player_id, "name": payload.get("name"), "points": payload.get("points"),
        "trophies": payload.get("trophies"), "coins": payload.get("coins"),
        "upgrades": payload.get("upgrades"), "skin": payload.get("skin"),
        "cosmicOwned": payload.get("cosmicOwned"), "heroVersion1": payload.get("heroVersion1"),
        "adminRevision": payload.get("adminRevision"), "revision": payload.get("revision"),
        "dataVersion": payload.get("dataVersion", PROFILE_DATA_VERSION), "data": incoming_data,
    })
    known_admin_revision = clean_number(payload.get("adminRevision"))
    client_version = clean_mode_text(payload.get("clientVersion"), 40)
    with db_connect() as conn:
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.execute(
                """SELECT player_id,name,points,trophies,coins,move_level,fire_level,hp_level,skin,cosmic_owned,hero_version1,admin_revision,revision,data_version,profile_data
                   FROM players WHERE player_id=%s FOR UPDATE""",
                (player_id,),
            )
            row = cur.fetchone()
            if row:
                old = profile_full_row({
                    "id":row[0],"name":row[1],"points":row[2],"trophies":row[3],"coins":row[4],
                    "move_level":row[5],"fire_level":row[6],"hp_level":row[7],"skin":row[8],
                    "cosmic_owned":row[9],"hero_version1":row[10],"admin_revision":row[11],
                    "revision":row[12],"data_version":row[13],"profile_data":row[14],
                })
                if old["adminRevision"] > known_admin_revision:
                    merged = dict(old)
                    if incoming["name"] != "Gracz" or old["name"] == "Gracz":
                        merged["name"] = incoming["name"]
                else:
                    merged = dict(incoming)
                    if incoming["name"] == "Gracz" and old["name"] != "Gracz":
                        merged["name"] = old["name"]
                    merged["points"] = max(old["points"], incoming["points"])
                    merged["trophies"] = max(old["trophies"], incoming["trophies"])
                    merged["coins"] = max(old["coins"], incoming["coins"])
                    merged["upgrades"] = {k:max(old["upgrades"][k],incoming["upgrades"][k]) for k in ("move","fire","hp")}
                    merged["cosmicOwned"] = old["cosmicOwned"] or incoming["cosmicOwned"]
                    merged["heroVersion1"] = old["heroVersion1"] or incoming["heroVersion1"]
                    merged["skin"] = incoming["skin"] if incoming["skin"] == "classic" or merged["cosmicOwned"] else old["skin"]
                    merged["adminRevision"] = old["adminRevision"]
                    merged["data"] = {**old.get("data", {}), **incoming_data}
                    merged["dataVersion"] = max(old.get("dataVersion", 1), incoming.get("dataVersion", 1))
                cur.execute(
                    """UPDATE players SET name=%s,points=%s,trophies=%s,coins=%s,move_level=%s,fire_level=%s,hp_level=%s,
                           skin=%s,cosmic_owned=%s,hero_version1=%s,admin_revision=%s,profile_data=%s::jsonb,data_version=%s,
                           revision=revision+1,last_client_version=%s,last_seen=NOW(),updated_at=NOW()
                       WHERE player_id=%s
                       RETURNING player_id,name,points,trophies,coins,move_level,fire_level,hp_level,skin,cosmic_owned,hero_version1,admin_revision,revision,data_version,profile_data""",
                    (merged["name"],merged["points"],merged["trophies"],merged["coins"],merged["upgrades"]["move"],merged["upgrades"]["fire"],merged["upgrades"]["hp"],merged["skin"],merged["cosmicOwned"],merged["heroVersion1"],merged["adminRevision"],json.dumps(merged.get("data",{}),ensure_ascii=False),merged.get("dataVersion",PROFILE_DATA_VERSION),client_version,player_id),
                )
            else:
                cur.execute(
                    """INSERT INTO players (player_id,name,points,trophies,coins,move_level,fire_level,hp_level,skin,cosmic_owned,hero_version1,admin_revision,revision,data_version,profile_data,last_client_version,last_seen,updated_at)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,1,%s,%s::jsonb,%s,NOW(),NOW())
                       RETURNING player_id,name,points,trophies,coins,move_level,fire_level,hp_level,skin,cosmic_owned,hero_version1,admin_revision,revision,data_version,profile_data""",
                    (player_id,incoming["name"],incoming["points"],incoming["trophies"],incoming["coins"],incoming["upgrades"]["move"],incoming["upgrades"]["fire"],incoming["upgrades"]["hp"],incoming["skin"],incoming["cosmicOwned"],incoming["heroVersion1"],incoming.get("dataVersion",PROFILE_DATA_VERSION),json.dumps(incoming_data,ensure_ascii=False),client_version),
                )
            result = cur.fetchone()
            cur.execute(
                "INSERT INTO data_audit(account_id,event_type,payload) VALUES (%s,'profile_sync',%s::jsonb)",
                (player_id, json.dumps({"revision": int(result[12]), "clientVersion": client_version}, ensure_ascii=False)),
            )
        conn.commit()
    touch(player_id)
    return profile_full_row({
        "id":result[0],"name":result[1],"points":result[2],"trophies":result[3],"coins":result[4],
        "move_level":result[5],"fire_level":result[6],"hp_level":result[7],"skin":result[8],
        "cosmic_owned":result[9],"hero_version1":result[10],"admin_revision":result[11],
        "revision":result[12],"data_version":result[13],"profile_data":result[14],
    })


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


def save_match_result(account_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    mode = clean_mode_text(payload.get("mode"), 32) or "unknown"
    result = clean_mode_text(payload.get("result"), 24) or "finished"
    points_delta = clean_number(payload.get("pointsDelta"), 1_000_000_000)
    trophies_delta = clean_number(payload.get("trophiesDelta"), 1_000_000_000)
    coins_delta = clean_number(payload.get("coinsDelta"), 1_000_000_000)
    duration = clean_float(payload.get("durationSeconds"), 0.0, 7 * 24 * 3600, 0.0)
    details = clean_profile_data(payload.get("details"))
    client_version = clean_mode_text(payload.get("clientVersion"), 40)
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute(
                """INSERT INTO match_results(account_id,mode,result,points_delta,trophies_delta,coins_delta,duration_seconds,details,client_version)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s) RETURNING id,EXTRACT(EPOCH FROM created_at)""",
                (clean_id(account_id),mode,result,points_delta,trophies_delta,coins_delta,duration,json.dumps(details,ensure_ascii=False),client_version),
            )
            row = cur.fetchone()
        return {"ok": True, "id": int(row[0]), "createdAt": float(row[1])}
    return {"ok": True, "id": 0, "createdAt": now()}


def live_sync_payload(account_id: str, profile_revision: int, config_revision: int) -> dict[str, Any]:
    profile = db_get_profile(account_id) if DATABASE_URL else profile_full_row(profiles.get(account_id, {}))
    current_config_revision = db_config_revision() if DATABASE_URL else 0
    result: dict[str, Any] = {
        "ok": True,
        "serverTime": now(),
        "schemaVersion": DB_SCHEMA_VERSION if DATABASE_URL else 0,
        "storage": "postgres" if DATABASE_URL else "json",
        "profileRevision": clean_revision(profile.get("revision", 0) if profile else 0),
        "configRevision": current_config_revision,
        "online": online_count(),
    }
    if profile and result["profileRevision"] > clean_revision(profile_revision):
        result["profile"] = profile
    if current_config_revision > clean_revision(config_revision):
        result["config"] = public_game_config()
    return result


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
                "coins": clean_number(entry.get("coins")),
                "upgrades": {"move": clamp_int((entry.get("upgrades") or {}).get("move"),0,5,0), "fire": clamp_int((entry.get("upgrades") or {}).get("fire"),0,5,0), "hp": clamp_int((entry.get("upgrades") or {}).get("hp"),0,5,0)},
                "skin": clean_skin(entry.get("skin")), "cosmicOwned": bool(entry.get("cosmicOwned", False)),
                "heroVersion1": bool(entry.get("heroVersion1", False)), "adminRevision": clean_number(entry.get("adminRevision")),
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
    incoming = profile_full_row({
        "id":player_id,"name":payload.get("name"),"points":payload.get("points"),
        "trophies":payload.get("trophies"),"coins":payload.get("coins"),
        "upgrades":payload.get("upgrades"),"skin":payload.get("skin"),
        "cosmicOwned":payload.get("cosmicOwned"),"heroVersion1":payload.get("heroVersion1"),
        "adminRevision":payload.get("adminRevision"),"revision":payload.get("revision"),
        "dataVersion":payload.get("dataVersion",PROFILE_DATA_VERSION),"data":payload.get("data"),
    })
    old = profile_full_row(profiles.get(player_id, {"id":player_id,"name":"Gracz"}))
    known = clean_number(payload.get("adminRevision"))
    if old["adminRevision"] > known:
        entry = dict(old)
        if incoming["name"] != "Gracz" or old["name"] == "Gracz":
            entry["name"] = incoming["name"]
    else:
        entry = dict(incoming)
        if incoming["name"] == "Gracz" and old["name"] != "Gracz":
            entry["name"] = old["name"]
        entry["points"] = max(old["points"], incoming["points"])
        entry["trophies"] = max(old["trophies"], incoming["trophies"])
        entry["coins"] = max(old["coins"], incoming["coins"])
        entry["upgrades"] = {k:max(old["upgrades"][k],incoming["upgrades"][k]) for k in ("move","fire","hp")}
        entry["cosmicOwned"] = old["cosmicOwned"] or incoming["cosmicOwned"]
        entry["heroVersion1"] = old["heroVersion1"] or incoming["heroVersion1"]
        entry["adminRevision"] = old["adminRevision"]
        entry["data"] = {**old.get("data",{}), **incoming.get("data",{})}
        entry["dataVersion"] = max(old.get("dataVersion",1), incoming.get("dataVersion",1))
    entry["revision"] = max(old.get("revision",0), incoming.get("revision",0)) + 1
    profiles[player_id] = entry
    save_profiles(); touch(player_id); return entry


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



def admin_find_players(query: str = "", limit: int = 50) -> list[dict[str, Any]]:
    query = clean_mode_text(query, 80)
    limit = clamp_int(limit, 1, 100, 50)
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            if query:
                cur.execute("""SELECT player_id,name,points,trophies,coins,move_level,fire_level,hp_level,skin,cosmic_owned,hero_version1,admin_revision FROM players WHERE player_id ILIKE %s OR name ILIKE %s ORDER BY points DESC LIMIT %s""", (f"%{query}%",f"%{query}%",limit))
            else:
                cur.execute("""SELECT player_id,name,points,trophies,coins,move_level,fire_level,hp_level,skin,cosmic_owned,hero_version1,admin_revision FROM players ORDER BY updated_at DESC LIMIT %s""", (limit,))
            rows = cur.fetchall()
        return [profile_full_row({"id":r[0],"name":r[1],"points":r[2],"trophies":r[3],"coins":r[4],"move_level":r[5],"fire_level":r[6],"hp_level":r[7],"skin":r[8],"cosmic_owned":r[9],"hero_version1":r[10],"admin_revision":r[11]}) for r in rows]
    rows = [profile_full_row(v) for v in profiles.values()]
    if query:
        q = query.casefold(); rows = [r for r in rows if q in r["id"].casefold() or q in r["name"].casefold()]
    rows.sort(key=lambda r:(-r["points"],-r["trophies"],r["name"].casefold()))
    return rows[:limit]


def admin_update_player(payload: dict[str, Any]) -> dict[str, Any]:
    player_id = clean_id(payload.get("playerId"))
    if not player_id:
        raise ValueError("Brak identyfikatora gracza.")
    current = admin_find_players(player_id, 100)
    old = next((r for r in current if r["id"] == player_id), profile_full_row({"id":player_id,"name":payload.get("name") or "Gracz"}))
    entry = profile_full_row({
        "id":player_id, "name":payload.get("name",old["name"]), "points":payload.get("points",old["points"]),
        "trophies":payload.get("trophies",old["trophies"]), "coins":payload.get("coins",old["coins"]),
        "upgrades":payload.get("upgrades",old["upgrades"]), "skin":payload.get("skin",old["skin"]),
        "cosmicOwned":payload.get("cosmicOwned",old["cosmicOwned"]), "heroVersion1":payload.get("heroVersion1",old["heroVersion1"]),
        "adminRevision":old["adminRevision"]+1,
    })
    if entry["skin"] == "cosmic": entry["cosmicOwned"] = True
    if DATABASE_URL:
        with db_connect() as conn, conn.cursor() as cur:
            cur.execute("""
                INSERT INTO players (player_id,name,points,trophies,coins,move_level,fire_level,hp_level,skin,cosmic_owned,hero_version1,admin_revision,updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
                ON CONFLICT (player_id) DO UPDATE SET name=EXCLUDED.name,points=EXCLUDED.points,trophies=EXCLUDED.trophies,coins=EXCLUDED.coins,
                    move_level=EXCLUDED.move_level,fire_level=EXCLUDED.fire_level,hp_level=EXCLUDED.hp_level,skin=EXCLUDED.skin,
                    cosmic_owned=EXCLUDED.cosmic_owned,hero_version1=EXCLUDED.hero_version1,admin_revision=players.admin_revision+1,revision=players.revision+1,last_seen=NOW(),updated_at=NOW()
                RETURNING player_id,name,points,trophies,coins,move_level,fire_level,hp_level,skin,cosmic_owned,hero_version1,admin_revision
            """, (player_id,entry["name"],entry["points"],entry["trophies"],entry["coins"],entry["upgrades"]["move"],entry["upgrades"]["fire"],entry["upgrades"]["hp"],entry["skin"],entry["cosmicOwned"],entry["heroVersion1"],entry["adminRevision"]))
            r=cur.fetchone()
        return profile_full_row({"id":r[0],"name":r[1],"points":r[2],"trophies":r[3],"coins":r[4],"move_level":r[5],"fire_level":r[6],"hp_level":r[7],"skin":r[8],"cosmic_owned":r[9],"hero_version1":r[10],"admin_revision":r[11]})
    profiles[player_id]=entry; save_profiles(); return entry

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
        "maxRounds": int(game_config.get("duelMaxRounds", DUEL_MAX_ROUNDS)),
        "yourWins": int(wins.get(player_id, 0)),
        "opponentWins": int(wins.get(opponent_id, 0)),
        "roundDraws": int(match.get("round_draws", 0)),
        "roundResult": match.get("round_result", ""),
        "roundEventSeq": int(match.get("round_event_seq", 0)),
        "you": player_id,
        "serverTime": round(current, 4),
        "stateSeq": int(match.get("state_seq", 0)),
        "ackShotSeq": int(match["players"].get(player_id, {}).get("last_client_shot_seq", 0)),
        "build": "chat-global-private-offline-v3",
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
        player["last_client_shot_time"] = 0.0
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

    champion = next((pid for pid, value in wins.items() if int(value) >= int(game_config.get("duelWinsToTakeMatch", DUEL_WINS_TO_TAKE_MATCH))), None)
    if champion is not None:
        finish_duel(match, champion, "Koniec meczu: zwycięstwo 2 rundy.")
        return
    if current_round >= int(game_config.get("duelMaxRounds", DUEL_MAX_ROUNDS)):
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

        level = clamp_int(game_config.get("duelBotLevel"), 1, 10, 5)
        speed_factor = 0.65 + level * 0.07
        fire_factor = 1.35 - level * 0.075
        aim_spread = max(0.025, 0.19 - level * 0.015)
        bot["speed"] = float(bot.get("base_speed", bot["speed"])) * speed_factor
        bot["fire_cooldown"] = max(0.07, float(bot.get("base_fire_cooldown", bot["fire_cooldown"])) * fire_factor)
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
            aim = bot["angle"] + random.uniform(-aim_spread, aim_spread)
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
    max_hp = int(round(base_hp * float(game_config.get("duelHpMultiplier", DUEL_HP_MULTIPLIER))))
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
        "last_client_shot_time": 0.0,
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
        "base_speed": bot["speed"],
        "base_fire_cooldown": bot["fire_cooldown"],
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
        bot_wait = float(game_config.get("duelBotWaitSeconds", DUEL_BOT_WAIT))
        if elapsed >= bot_wait:
            duel_waiting.pop(player_id, None)
            bot_id = f"bot-{int(now() * 1000)}-{player_id[:10]}"
            match = create_duel_match(payload, player_id, payload, bot_id, second_is_bot=True)
            return duel_payload(match, player_id)
        return {
            "ok": True,
            "status": "waiting",
            "waitingSince": waiting["created_at"],
            "waitRemaining": max(0.0, bot_wait - elapsed),
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
        "waitRemaining": float(game_config.get("duelBotWaitSeconds", DUEL_BOT_WAIT)),
    }


def duel_state(match_id: str, player_id: str) -> dict[str, Any] | None:
    cleanup_duels()
    match = duel_matches.get(match_id)
    if not match or player_id not in match["players"]:
        return None
    match["players"][player_id]["last_seen"] = now()
    advance_duel(match)
    return duel_payload(match, player_id)


def process_duel_shots(match: dict[str, Any], player: dict[str, Any], shots: Any, current: float) -> int:
    """Przetwarza strzały osobno od ruchu, żeby opóźniony request pozycji nie blokował ognia."""
    if not isinstance(shots, list) or match.get("status") != "playing":
        return int(player.get("last_client_shot_seq", 0))
    fresh: list[tuple[int, float, dict[str, Any]]] = []
    last_seq = int(player.get("last_client_shot_seq", 0))
    for shot in shots[:8]:
        if not isinstance(shot, dict):
            continue
        seq = clean_number(shot.get("seq"), 2_000_000_000)
        if seq <= last_seq:
            continue
        try:
            client_time = float(shot.get("clientTime") or 0.0)
        except (TypeError, ValueError):
            client_time = 0.0
        fresh.append((seq, client_time, shot))
    fresh.sort(key=lambda item: item[0])
    last_client_time = float(player.get("last_client_shot_time", 0.0))
    accepted = 0
    for seq, client_time, shot in fresh:
        # Klient wysyła czas w milisekundach. Używamy tylko odstępu między
        # strzałami, a nie zegara absolutnego, więc różne strefy/czasy nie przeszkadzają.
        spacing_ok = not last_client_time or not client_time or (client_time - last_client_time) >= player["fire_cooldown"] * 1000.0 * 0.72
        server_spacing_ok = current - float(player.get("last_shot", 0.0)) >= player["fire_cooldown"] * 0.42
        if not (spacing_ok or server_spacing_ok):
            continue
        angle = normalize_duel_angle(shot.get("angle"), player["angle"])
        spawn_duel_bullet(match, player, angle, seq)
        player["last_client_shot_seq"] = seq
        player["last_client_shot_time"] = client_time or (last_client_time + player["fire_cooldown"] * 1000.0)
        player["last_shot"] = current
        player["revealed_until"] = current + 0.85
        last_client_time = float(player["last_client_shot_time"])
        accepted += 1
        if accepted >= 6:
            break
    return int(player.get("last_client_shot_seq", 0))


def duel_shoot(payload: dict[str, Any]) -> dict[str, Any] | None:
    match_id = clean_id(payload.get("matchId"))
    player_id = clean_id(payload.get("playerId"))
    match = duel_matches.get(match_id)
    if not match or player_id not in match["players"]:
        return None
    current = now()
    advance_duel(match)
    player = match["players"][player_id]
    player["last_seen"] = current
    ack = process_duel_shots(match, player, payload.get("shots"), current)
    advance_duel(match)
    match["state_seq"] = int(match.get("state_seq", 0)) + 1
    return {"ok": True, "ackShotSeq": ack, "stateSeq": int(match.get("state_seq", 0))}


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
        shots = [{"seq": int(player.get("last_client_shot_seq", 0)) + 1, "angle": payload.get("angle"), "clientTime": 0}] if payload.get("shoot") else []
    process_duel_shots(match, player, shots, current)
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
    server_version = "ArenaStarsSQL/4.0-live-sync"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[{self.log_date_time_string()}] {self.address_string()} - {fmt % args}")

    def send_json(self, data: Any, status: int = 200, extra_headers: dict[str, str] | None = None) -> None:
        raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        try:
            self.wfile.write(raw)
        except (BrokenPipeError, ConnectionResetError):
            # Przeglądarka mogła anulować spóźnione zapytanie; serwer ma działać dalej.
            pass

    def read_json(self, max_length: int = MAX_BODY) -> dict[str, Any] | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None
        if length <= 0 or length > max_length:
            return None
        try:
            value = json.loads(self.rfile.read(length).decode("utf-8"))
            return value if isinstance(value, dict) else None
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None

    def read_bytes(self, max_length: int) -> bytes | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None
        if length <= 0 or length > max_length:
            return None
        return self.rfile.read(length)

    def client_ip(self) -> str:
        forwarded = self.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        return forwarded or str(self.client_address[0])

    def cookie_value(self, wanted: str) -> str:
        cookie = self.headers.get("Cookie", "")
        for part in cookie.split(";"):
            key, _, value = part.strip().partition("=")
            if key == wanted:
                return value
        return ""

    def account_token(self) -> str:
        return self.cookie_value("arena_session")

    def account_session(self) -> dict[str, Any] | None:
        return verify_account_session(self.account_token())

    def require_account(self, allow_banned: bool = False) -> dict[str, Any] | None:
        account = self.account_session()
        if not account:
            self.send_json({"error":"Zaloguj się do konta.","authRequired":True}, HTTPStatus.UNAUTHORIZED)
            return None
        ban = account_ban_payload(account)
        if ban["banned"] and not allow_banned:
            self.send_json({"error":"Konto jest zbanowane.",**ban}, HTTPStatus.LOCKED)
            return None
        touch(clean_id(account.get("account_id")))
        return account

    def public_base_url(self) -> str:
        host = self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or ""
        proto = self.headers.get("X-Forwarded-Proto") or ""
        return build_public_url(host, proto)

    def send_account_login(self, account: dict[str, Any]) -> None:
        account_id = clean_id(account.get("account_id"))
        token = secrets.token_urlsafe(36)
        digest = token_hash(token)
        expiry = now() + AUTH_SESSION_TTL
        profile = None
        if DATABASE_URL:
            # Jedno połączenie z Neon zamiast kilku kolejnych — logowanie jest znacznie szybsze.
            with db_connect() as conn, conn.cursor() as cur:
                cur.execute("DELETE FROM account_sessions WHERE expires_at < NOW()")
                cur.execute("INSERT INTO account_sessions (token_hash,account_id,expires_at) VALUES (%s,%s,TO_TIMESTAMP(%s))", (digest,account_id,expiry))
                cur.execute("UPDATE accounts SET last_login=NOW() WHERE account_id=%s", (account_id,))
                cur.execute(
                    """SELECT player_id,name,points,trophies,coins,move_level,fire_level,hp_level,skin,cosmic_owned,hero_version1,admin_revision,revision,data_version,profile_data
                       FROM players WHERE player_id=%s""",
                    (account_id,),
                )
                profile = profile_from_db_row(cur.fetchone())
        else:
            local_auth_sessions[digest] = {"account_id":account_id,"expires":expiry}
            if account_id in local_accounts:
                local_accounts[account_id]["last_login"] = now()
                save_account_storage()
            profile = profile_full_row(profiles.get(account_id,{}))
        secure = bool(os.environ.get("RENDER")) or self.headers.get("X-Forwarded-Proto") == "https"
        cookie = f"arena_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={AUTH_SESSION_TTL}" + ("; Secure" if secure else "")
        self.send_json({"ok":True,"account":account_public(account),"profile":profile}, extra_headers={"Set-Cookie":cookie})

    def admin_token(self) -> str:
        cookie = self.headers.get("Cookie", "")
        for part in cookie.split(";"):
            key, _, value = part.strip().partition("=")
            if key == "arena_admin":
                return value
        return ""

    def admin_session(self) -> dict[str, Any] | None:
        return verify_admin_session(self.admin_token())

    def require_admin(self) -> dict[str, Any] | None:
        session = self.admin_session()
        account = self.account_session()
        account_id = clean_id(account.get("account_id")) if account else ""
        if not session or not account or not admin_account_allowed(account_id) or clean_id(session.get("playerId")) != account_id:
            self.send_json({"error": "Panel jest dostępny tylko na koncie właściciela."}, HTTPStatus.FORBIDDEN)
            return None
        return session

    def send_admin_login(self, player_id: str) -> None:
        token = create_admin_session(player_id)
        secure = bool(os.environ.get("RENDER")) or self.headers.get("X-Forwarded-Proto") == "https"
        cookie = f"arena_admin={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={ADMIN_SESSION_TTL}" + ("; Secure" if secure else "")
        self.send_json({"ok": True, "expiresIn": ADMIN_SESSION_TTL}, extra_headers={"Set-Cookie": cookie})

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/auth/status":
            account = self.account_session()
            if not account:
                self.send_json({"ok":True,"authenticated":False}); return
            account_id = clean_id(account.get("account_id"))
            profile = db_get_profile(account_id) if DATABASE_URL else profile_full_row(profiles.get(account_id, {}))
            self.send_json({"ok":True,"authenticated":True,"account":account_public(account),"profile":profile}); return
        if parsed.path == "/api/chat/users":
            account=self.require_account()
            if not account: return
            q=(parse_qs(parsed.query).get("q") or [""])[0]
            self.send_json({"ok":True,"users":chat_users(account["account_id"],q)}); return
        if parsed.path == "/api/chat/messages":
            account=self.require_account()
            if not account: return
            self.send_json({"ok":True,"messages":chat_history(account["account_id"])}); return
        if parsed.path == "/api/admin/accounts":
            if not self.require_admin(): return
            q=(parse_qs(parsed.query).get("q") or [""])[0]
            self.send_json({"ok":True,"accounts":admin_accounts(q)}); return
        if parsed.path == "/api/sync":
            account = self.require_account()
            if not account: return
            query = parse_qs(parsed.query)
            profile_revision = clean_revision((query.get("profileRevision") or [0])[0])
            config_revision = clean_revision((query.get("configRevision") or [0])[0])
            try:
                self.send_json(live_sync_payload(account["account_id"], profile_revision, config_revision))
            except Exception as exc:
                print(f"Błąd synchronizacji danych: {exc}")
                self.send_json({"error":"Synchronizacja chwilowo niedostępna."}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if parsed.path == "/api/database/status":
            if not self.require_admin(): return
            try:
                self.send_json({"ok": True, **db_schema_status()})
            except Exception as exc:
                self.send_json({"error": str(exc)}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if parsed.path == "/api/config":
            self.send_json({"ok": True, "config": public_game_config(), "configRevision": db_config_revision() if DATABASE_URL else 0})
            return
        if parsed.path == "/api/admin/status":
            account = self.account_session()
            account_id = clean_id(account.get("account_id")) if account else ""
            session = self.admin_session()
            matches = bool(account_id and admin_account_allowed(account_id))
            authorized = bool(session and matches and clean_id(session.get("playerId")) == account_id)
            self.send_json({
                "ok": True, "configured": bool(ADMIN_PASSWORD and ADMIN_RECOVERY_CODE),
                "authorized": authorized, "accountMatches": matches,
                "playerIdRequired": True,
                "deploymentConfigured": bool(GITHUB_TOKEN and GITHUB_REPO),
                "repo": GITHUB_REPO if authorized else "", "branch": GITHUB_BRANCH if authorized else "",
            })
            return
        if parsed.path == "/api/admin/config":
            if not self.require_admin(): return
            self.send_json({"ok": True, "config": public_game_config()})
            return
        if parsed.path == "/api/admin/players":
            if not self.require_admin(): return
            query = parse_qs(parsed.query)
            text = (query.get("q") or [""])[0]
            self.send_json({"ok": True, "players": admin_find_players(text, 50)})
            return
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
            account=self.require_account()
            if not account: return
            query = parse_qs(parsed.query)
            match_id = clean_id((query.get("matchId") or [""])[0])
            player_id = clean_id(account.get("account_id"))
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
                self.send_json({"ok": True, "storage": "postgres" if DATABASE_URL else "json", "build": "mobile-real-fullscreen-scroll-v1", "schemaVersion": DB_SCHEMA_VERSION if DATABASE_URL else 0})
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        self.serve_static(parsed.path)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/admin/deploy-zip":
            if not self.require_admin(): return
            raw = self.read_bytes(ADMIN_UPLOAD_MAX_RAW)
            if raw is None:
                self.send_json({"error":"ZIP jest pusty albo przekracza 40 MB."}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE); return
            try:
                file_name = unquote(self.headers.get("X-File-Name", "aktualizacja.zip"))
                encoded = self.headers.get("X-Commit-Message-B64", "")
                if encoded:
                    encoded += "=" * (-len(encoded) % 4)
                    message = base64.b64decode(encoded).decode("utf-8", "replace")
                else:
                    message = "Aktualizacja gry z panelu administratora"
                decoded = decode_admin_zip_bytes(raw, Path(file_name).name)
                result = deploy_decoded_to_github(decoded, message, "zip-raw")
                self.send_json(result)
            except Exception as exc:
                self.send_json({"error":str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        payload = self.read_json(ADMIN_UPLOAD_MAX_BODY if parsed.path == "/api/admin/deploy" else MAX_BODY)
        if payload is None:
            self.send_json({"error": "Nieprawidłowe dane."}, HTTPStatus.BAD_REQUEST)
            return
        if parsed.path == "/api/auth/password-reset/request":
            try:
                create_password_reset(payload.get("email"), self.public_base_url(), self.client_ip())
                self.send_json({"ok":True,"message":"Jeśli konto z takim adresem istnieje, wysłaliśmy link do zmiany hasła."})
            except ValueError as exc:
                self.send_json({"error":str(exc)}, HTTPStatus.BAD_REQUEST)
            except RuntimeError as exc:
                status = HTTPStatus.TOO_MANY_REQUESTS if "Za dużo prób" in str(exc) else HTTPStatus.SERVICE_UNAVAILABLE
                self.send_json({"error":str(exc)}, status)
            except Exception as exc:
                print(f"Błąd prośby o reset hasła: {type(exc).__name__}: {exc}")
                self.send_json({"error":"Reset hasła jest chwilowo niedostępny."}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if parsed.path == "/api/auth/password-reset/confirm":
            try:
                reset_account_password(payload.get("token"),payload.get("password"),payload.get("repeatPassword"))
                self.send_json({"ok":True})
            except ValueError as exc:
                self.send_json({"error":str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception as exc:
                print(f"Błąd zmiany hasła: {type(exc).__name__}: {exc}")
                self.send_json({"error":"Nie udało się zmienić hasła."}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if parsed.path == "/api/auth/set-email":
            account = self.require_account(allow_banned=True)
            if not account: return
            try:
                updated = account_set_email(clean_id(account.get("account_id")), payload.get("email"))
                account_id = clean_id(updated.get("account_id"))
                profile = db_get_profile(account_id) if DATABASE_URL else profile_full_row(profiles.get(account_id, {}))
                self.send_json({"ok":True,"account":account_public(updated),"profile":profile})
            except ValueError as exc:
                self.send_json({"error":str(exc)}, HTTPStatus.CONFLICT)
            except Exception as exc:
                print(f"Błąd zapisu e-maila: {type(exc).__name__}: {exc}")
                self.send_json({"error":"Nie udało się zapisać adresu e-mail."}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if parsed.path == "/api/auth/register":
            try:
                with lock:
                    account = account_create(payload.get("username"),payload.get("email"),payload.get("password"),payload.get("playerId"))
                self.send_account_login(account)
            except ValueError as exc:
                self.send_json({"error":str(exc)}, HTTPStatus.CONFLICT)
            except Exception as exc:
                print(f"Błąd rejestracji konta: {type(exc).__name__}: {exc}")
                self.send_json({"error":"Baza kont chwilowo nie odpowiada. Spróbuj ponownie za kilka sekund."}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if parsed.path == "/api/auth/login":
            try:
                _, key = normalize_username(payload.get("username"))
                account = account_get_by_username(key)
                if not account:
                    self.send_json({"error":"Takie konto nie istnieje."}, HTTPStatus.NOT_FOUND); return
                if not verify_password(str(payload.get("password") or ""), account["password_hash"], account["password_salt"]):
                    self.send_json({"error":"Nieprawidłowe hasło do konta."}, HTTPStatus.UNAUTHORIZED); return
                ban = account_ban_payload(account)
                if ban["banned"]:
                    self.send_json({"error":"Konto jest zbanowane.",**ban}, HTTPStatus.LOCKED); return
                self.send_account_login(account)
            except ValueError as exc:
                self.send_json({"error":str(exc)}, HTTPStatus.BAD_REQUEST)
            except Exception as exc:
                print(f"Błąd logowania konta: {type(exc).__name__}: {exc}")
                self.send_json({"error":"Baza kont chwilowo nie odpowiada. Spróbuj ponownie za kilka sekund."}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if parsed.path == "/api/auth/logout":
            delete_account_session(self.account_token())
            self.send_json({"ok":True},extra_headers={"Set-Cookie":"arena_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"}); return
        if parsed.path == "/api/chat/send":
            account=self.require_account()
            if not account: return
            try:
                result=chat_send(account,payload.get("recipients"),payload.get("body"),payload.get("broadcast"))
                if result.get("banned"): self.send_json({"error":"Automatyczny ban za przeklinanie.",**result},HTTPStatus.LOCKED)
                else: self.send_json(result)
            except ValueError as exc: self.send_json({"error":str(exc)},HTTPStatus.BAD_REQUEST)
            return
        if parsed.path == "/api/admin/ban":
            if not self.require_admin(): return
            aid=clean_id(payload.get("accountId")); seconds=max(60,min(365*24*3600,float(payload.get("durationSeconds") or 0)))
            if not account_get(aid): self.send_json({"error":"Nie znaleziono konta."},HTTPStatus.NOT_FOUND); return
            self.send_json({"ok":True,"account":set_account_ban(aid,seconds,str(payload.get("reason") or "Ban administratora"))}); return
        if parsed.path == "/api/admin/unban":
            if not self.require_admin(): return
            aid=clean_id(payload.get("accountId"))
            self.send_json({"ok":True,"account":clear_account_ban(aid)}); return
        if parsed.path in {"/api/admin/login", "/api/admin/recover"}:
            ip = self.client_ip()
            wait = admin_login_locked(ip)
            if wait > 0:
                self.send_json({"error": f"Za dużo prób. Spróbuj ponownie za {int(wait)+1} s."}, HTTPStatus.TOO_MANY_REQUESTS); return
            account = self.require_account()
            if not account: return
            player_id = clean_id(account.get("account_id"))
            if not ADMIN_PASSWORD or not ADMIN_RECOVERY_CODE:
                self.send_json({"error": "Panel administratora nie jest skonfigurowany w Renderze."}, HTTPStatus.SERVICE_UNAVAILABLE); return
            if not admin_account_allowed(player_id):
                record_admin_login_failure(ip); self.send_json({"error": "Panel jest dostępny tylko na koncie właściciela."}, HTTPStatus.FORBIDDEN); return
            expected = ADMIN_PASSWORD if parsed.path.endswith("login") else ADMIN_RECOVERY_CODE
            provided = payload.get("password") if parsed.path.endswith("login") else payload.get("code")
            if not admin_secret_equal(provided, expected):
                record_admin_login_failure(ip); self.send_json({"error": "Nieprawidłowe hasło lub kod."}, HTTPStatus.UNAUTHORIZED); return
            admin_login_attempts.pop(ip, None); self.send_admin_login(player_id); return
        if parsed.path == "/api/admin/logout":
            token = self.admin_token(); admin_sessions.pop(token, None)
            self.send_json({"ok": True}, extra_headers={"Set-Cookie": "arena_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"}); return
        if parsed.path == "/api/admin/config":
            if not self.require_admin(): return
            try:
                with lock: config = save_game_config(payload.get("config"))
                self.send_json({"ok": True, "config": config})
            except Exception as exc:
                self.send_json({"error": f"Nie udało się zapisać ustawień: {exc}"}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        if parsed.path == "/api/admin/player":
            if not self.require_admin(): return
            try:
                with lock: player = admin_update_player(payload)
                self.send_json({"ok": True, "player": player})
            except Exception as exc:
                self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        if parsed.path == "/api/admin/deploy":
            if not self.require_admin(): return
            try:
                result = deploy_files_to_github(payload.get("files"), payload.get("archive"), str(payload.get("message") or ""))
                self.send_json(result)
            except Exception as exc:
                self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        if parsed.path == "/api/match/result":
            account = self.require_account()
            if not account: return
            try:
                self.send_json(save_match_result(account["account_id"], payload))
            except Exception as exc:
                print(f"Błąd zapisu wyniku meczu: {exc}")
                self.send_json({"error":"Nie udało się zapisać historii meczu."}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if parsed.path == "/api/profile":
            account=self.require_account()
            if not account: return
            payload["playerId"]=account["account_id"]; payload["name"]=account["username"]
            try:
                with lock:
                    entry = upsert_profile(payload)
                    if not entry:
                        self.send_json({"error": "Brak identyfikatora gracza."}, HTTPStatus.BAD_REQUEST)
                        return
                    response = leaderboard_payload(entry["id"])
                    response.update({"ok": True, "profile": profile_full_row(entry)})
                    self.send_json(response)
            except Exception as exc:
                print(f"Błąd zapisu profilu: {exc}")
                self.send_json({"error": "Nie udało się zapisać profilu."}, HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if parsed.path == "/api/duel/join":
            account=self.require_account()
            if not account: return
            payload["playerId"]=account["account_id"]
            payload["name"]=account["username"]
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
            account=self.require_account()
            if not account: return
            payload["playerId"]=account["account_id"]
            payload["name"]=account["username"]
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
        if parsed.path == "/api/duel/shoot":
            account=self.require_account()
            if not account: return
            payload["playerId"]=account["account_id"]
            payload["name"]=account["username"]
            try:
                with lock:
                    result = duel_shoot(payload)
                if result is None:
                    self.send_json({"error": "Nie znaleziono pojedynku."}, HTTPStatus.NOT_FOUND)
                else:
                    self.send_json(result)
            except Exception as exc:
                print(f"Błąd strzału pojedynku: {exc}")
                self.send_json({"error": "Nie udało się wysłać strzału."}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        if parsed.path == "/api/duel/leave":
            account=self.require_account()
            if not account: return
            payload["playerId"]=account["account_id"]
            payload["name"]=account["username"]
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
    load_account_storage()
    init_db_pool()
    init_database()
    load_game_config()
    threading.Thread(target=duel_tick_loop, name="duel-tick", daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("\nArena Stars 3D — PRZETRWANIE + POJEDYNKI 1V1/BOT + TOP 200")
    print(f"Adres lokalny: http://localhost:{PORT}")
    print(f"Adres w tej samej sieci: http://{local_ip()}:{PORT}")
    print(f"Zapis danych: {'PostgreSQL/Neon, schemat v'+str(DB_SCHEMA_VERSION) if DATABASE_URL else 'lokalny JSON (tryb testowy)'}")
    print("Zatrzymanie serwera: Ctrl+C\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSerwer zatrzymany.")
    finally:
        server.server_close()
        close_db_pool()
