# -*- coding: utf-8 -*-
"""
KickWatch - baut pro Nutzer einen privaten .ics-Kalender-Feed mit genau
dessen gespeicherten Lieblingsvereinen (data/calendar/{calendarToken}.ics).

Der Token ist ein zufaelliger, nicht erratbarer Wert, den das Frontend beim
ersten Oeffnen des Kalender-Bereichs erzeugt und in Firestore speichert -
getrennt von der Firebase-UID, damit der Link bei Bedarf widerrufen/neu
erzeugt werden kann, ohne den Account zu beruehren. Wie bei jedem
Kalender-Abo (Google/Outlook funktionieren nach demselben Prinzip) gilt:
wer den Link kennt, kann die Termine lesen - der Link selbst ist das
Geheimnis, es gibt keinen zusaetzlichen Login pro Abruf.

Laeuft NACH fetch_fixtures.py im selben Workflow-Schritt und liest dessen
Ergebnis (data/fixtures.json) direkt weiter, statt die Spiele erneut
abzurufen.
"""

import json
import sys
import unicodedata
import uuid
from datetime import datetime, timezone
from pathlib import Path

from firestore_favorites import get_users_with_calendar_tokens

FIXTURES_FILE = Path(__file__).resolve().parent.parent / "data" / "fixtures.json"
CALENDAR_DIR = Path(__file__).resolve().parent.parent / "data" / "calendar"


def normalize_team_name(s: str) -> str:
    s = (s or "").lower()
    s = unicodedata.normalize("NFD", s)
    return "".join(ch for ch in s if unicodedata.category(ch) != "Mn")


def team_matches(favorite: str, team_name: str) -> bool:
    f = normalize_team_name(favorite)
    t = normalize_team_name(team_name)
    if not f or not t:
        return False
    return f in t or t in f


def fixtures_for_favorites(fixtures: list, favorite_teams: list) -> list:
    return [
        f
        for f in fixtures
        if any(team_matches(fav, f.get("homeTeam", "")) or team_matches(fav, f.get("awayTeam", "")) for fav in favorite_teams)
    ]


def to_ics_datetime(iso_utc: str) -> str:
    # z.B. "2026-08-28T18:30:00Z" -> "20260828T183000Z"
    dt = datetime.strptime(iso_utc, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    return dt.strftime("%Y%m%dT%H%M%SZ")


def escape_ics_text(s: str) -> str:
    return (s or "").replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;")


def build_ics(fixtures: list) -> str:
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//KickWatch//DE",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:KickWatch - Meine Vereine",
    ]
    for f in fixtures:
        kickoff = f.get("kickoffUtc")
        if not kickoff:
            continue
        try:
            dtstart = to_ics_datetime(kickoff)
        except ValueError:
            continue
        uid = uuid.uuid5(uuid.NAMESPACE_URL, f"kickwatch:{f.get('homeTeam')}:{f.get('awayTeam')}:{kickoff}")
        summary = escape_ics_text(f"{f.get('homeTeam', '')} - {f.get('awayTeam', '')}")
        description = escape_ics_text(f.get("competition", ""))
        lines += [
            "BEGIN:VEVENT",
            f"UID:{uid}@kickwatch.app",
            f"DTSTAMP:{now}",
            f"DTSTART:{dtstart}",
            f"SUMMARY:{summary}",
            f"DESCRIPTION:{description}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def main():
    if not FIXTURES_FILE.exists():
        print("[WARN] data/fixtures.json nicht gefunden, ueberspringe Kalender-Erzeugung.", file=sys.stderr)
        return

    fixtures = json.loads(FIXTURES_FILE.read_text(encoding="utf-8"))
    users = get_users_with_calendar_tokens()

    CALENDAR_DIR.mkdir(parents=True, exist_ok=True)
    active_filenames = set()

    for user in users:
        user_fixtures = fixtures_for_favorites(fixtures, user["favoriteTeams"])
        ics = build_ics(user_fixtures)
        filename = f"{user['calendarToken']}.ics"
        (CALENDAR_DIR / filename).write_text(ics, encoding="utf-8")
        active_filenames.add(filename)
        print(f"[INFO] Kalender fuer Nutzer {user['uid']}: {len(user_fixtures)} Termine -> {filename}")

    # Alte Feeds von Tokens, die es nicht mehr gibt (z.B. neu erzeugt),
    # aufraeumen statt verwaiste Dateien stehen zu lassen.
    for existing in CALENDAR_DIR.glob("*.ics"):
        if existing.name not in active_filenames:
            existing.unlink()
            print(f"[INFO] Verwaisten Kalender-Feed entfernt: {existing.name}")

    print(f"[OK] {len(active_filenames)} Kalender-Feed(s) geschrieben nach {CALENDAR_DIR}")


if __name__ == "__main__":
    main()
