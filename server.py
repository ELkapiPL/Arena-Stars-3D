#!/usr/bin/env python3
"""Arena Stars 3D — serwer profili i rankingu dla osobnych rozgrywek solo.

Serwer NIE synchronizuje areny, pozycji ani strzałów. Każdy gracz rozgrywa
własny mecz. Online są wyłącznie profile, wyniki i ranking.
"""
from __future__ import annotations

import json
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
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8000"))
VISIBLE_RANKING_SIZE = 200
ACTIVE_TIMEOUT = 12.0
MAX_BODY = 64 * 1024

lock = threading.RLock()
profiles: dict[str, dict[str, Any]] = {}
active_players: dict[str, float] = {}


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


def clean_float(value: Any, low: float, high: float, default: float = 0.0) -> float:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return default
    return max(low, min(high, num))


def load_profiles() -> None:
    global profiles
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
                "updated": clean_float(entry.get("updated"), 0, 99_999_999_999, now()),
            }
        profiles = cleaned
    except (OSError, json.JSONDecodeError):
        profiles = {}


def save_profiles() -> None:
    temp = DATA_FILE.with_suffix(".tmp")
    temp.write_text(json.dumps(profiles, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(DATA_FILE)


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


def upsert_profile(payload: dict[str, Any], persist: bool = True) -> dict[str, Any] | None:
    player_id = clean_id(payload.get("playerId"))
    if not player_id:
        return None

    entry = profiles.get(
        player_id,
        {"id": player_id, "name": "Gracz", "points": 0, "trophies": 0, "updated": now()},
    )
    old_snapshot = (
        entry.get("name"),
        clean_number(entry.get("points")),
        clean_number(entry.get("trophies")),
    )
    entry["name"] = clean_name(payload.get("name", entry["name"]))
    # Wyniki nie mogą zostać przypadkiem zmniejszone przez starszy zapis klienta.
    entry["points"] = max(clean_number(entry.get("points")), clean_number(payload.get("points")))
    entry["trophies"] = max(clean_number(entry.get("trophies")), clean_number(payload.get("trophies")))
    entry["updated"] = now()
    profiles[player_id] = entry
    touch(player_id)

    new_snapshot = (entry["name"], entry["points"], entry["trophies"])
    if persist and new_snapshot != old_snapshot:
        save_profiles()
    return entry


def sorted_profiles() -> list[dict[str, Any]]:
    return sorted(
        profiles.values(),
        key=lambda row: (
            -clean_number(row.get("points")),
            -clean_number(row.get("trophies")),
            str(row.get("name", "")).casefold(),
            str(row.get("id", "")),
        ),
    )


def public_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "points": clean_number(row["points"]),
        "trophies": clean_number(row["trophies"]),
    }


def leaderboard_payload(player_id: str = "") -> dict[str, Any]:
    rows = sorted_profiles()
    position = next((index + 1 for index, row in enumerate(rows) if row["id"] == player_id), None)
    return {
        "players": [public_row(row) for row in rows[:VISIBLE_RANKING_SIZE]],
        "position": position,
        "totalPlayers": len(rows),
        "online": online_count(),
        "visible": VISIBLE_RANKING_SIZE,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "ArenaStarsSoloRanking/2.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[{self.log_date_time_string()}] {self.address_string()} - {fmt % args}")

    def send_json(self, data: Any, status: int = 200) -> None:
        raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

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
            with lock:
                touch(player_id)
                self.send_json(leaderboard_payload(player_id))
            return
        if parsed.path == "/api/health":
            with lock:
                self.send_json({"ok": True, "online": online_count(), "totalPlayers": len(profiles), "mode": "solo-ranking"})
            return
        self.serve_static(parsed.path)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        payload = self.read_json()
        if payload is None:
            self.send_json({"error": "Nieprawidłowe dane."}, HTTPStatus.BAD_REQUEST)
            return

        if parsed.path == "/api/profile":
            with lock:
                entry = upsert_profile(payload)
                if not entry:
                    self.send_json({"error": "Brak identyfikatora gracza."}, HTTPStatus.BAD_REQUEST)
                    return
                response = leaderboard_payload(entry["id"])
                response.update({"ok": True, "profile": public_row(entry)})
                self.send_json(response)
            return

        # Celowo nie ma endpointu synchronizacji areny. Każdy gra sam.
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
        content_type = f"{mime}; charset=utf-8" if mime.startswith("text/") or mime in {"application/javascript", "application/json"} else mime
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-cache")
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
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("\nArena Stars 3D ONLINE — TRYB SOLO + RANKING")
    print(f"Na tym komputerze: http://localhost:{PORT}")
    print(f"W tej samej sieci Wi-Fi/LAN: http://{local_ip()}:{PORT}")
    print("Każdy gracz rozgrywa osobny mecz. Serwer przechowuje profile i ranking.")
    print("Ranking pokazuje 200 najlepszych, ale liczba zapisanych profili nie ma limitu 200.")
    print("Dostęp przez internet wymaga hostingu albo przekierowania portu.")
    print("Zatrzymanie serwera: Ctrl+C\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSerwer zatrzymany.")
    finally:
        server.server_close()
