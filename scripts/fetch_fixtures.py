# -*- coding: utf-8 -*-
"""
KickWatch - Spielplan-Abruf ueber TheSportsDB

Testphase: ruft die naechsten Spiele fuer eine feste Liste von Vereinen ab
und schreibt sie nach data/fixtures.json. Sobald Nutzerprofile (Firebase)
existieren, wird TEAMS hier durch die tatsaechlich von Nutzern favorisierten
Vereine ersetzt.

Nutzt den oeffentlichen, kostenlosen Test-Key '3' von TheSportsDB (kein
Secret noetig). Bei spuerbaren Rate-Limits oder luecken- haften Daten kann
spaeter auf einen eigenen (Patreon-)Key umgestellt werden.
"""

import json
import sys
from pathlib import Path

import requests

BASE = "https://www.thesportsdb.com/api/v1/json/3"
OUTPUT_FILE = Path(__file__).resolve().parent.parent / "data" / "fixtures.json"

# Testphase: Vereinsname -> wird zur Laufzeit per Suche in eine TheSportsDB
# Team-ID aufgeloest (robuster als IDs hart zu codieren).
TEAMS = [
    "VfB Stuttgart",
]


def find_team_id(team_name: str):
    resp = requests.get(f"{BASE}/searchteams.php", params={"t": team_name}, timeout=20)
    resp.raise_for_status()
    teams = resp.json().get("teams") or []
    if not teams:
        print(f"[WARN] Kein Team gefunden fuer '{team_name}'", file=sys.stderr)
        return None
    # Ersten Treffer nehmen; bei mehrdeutigen Namen spaeter Auswahl anbieten.
    team = teams[0]
    print(f"[INFO] '{team_name}' -> Team-ID {team['idTeam']} ({team['strTeam']}, {team.get('strCountry')})")
    return team["idTeam"]


def fetch_upcoming_fixtures(team_id: str) -> list:
    resp = requests.get(f"{BASE}/eventsnext.php", params={"id": team_id}, timeout=20)
    resp.raise_for_status()
    return resp.json().get("events") or []


def to_fixture_dict(event: dict) -> dict:
    date = event.get("dateEvent")
    time_ = event.get("strTime") or "00:00:00"
    return {
        "homeTeam": event.get("strHomeTeam"),
        "awayTeam": event.get("strAwayTeam"),
        "kickoffUtc": f"{date}T{time_}Z" if date else None,
        "competition": event.get("strLeague") or "Freundschaftsspiel",
        "venue": event.get("strVenue"),
    }


def main():
    all_fixtures = []
    for team_name in TEAMS:
        team_id = find_team_id(team_name)
        if team_id is None:
            continue
        raw_fixtures = fetch_upcoming_fixtures(team_id)
        print(f"[INFO] {team_name}: {len(raw_fixtures)} kommende Spiele gefunden")
        all_fixtures.extend(to_fixture_dict(e) for e in raw_fixtures)

    all_fixtures = [f for f in all_fixtures if f["kickoffUtc"]]
    all_fixtures.sort(key=lambda f: f["kickoffUtc"])
    OUTPUT_FILE.write_text(json.dumps(all_fixtures, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] {len(all_fixtures)} Spiele geschrieben nach {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
