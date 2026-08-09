# -*- coding: utf-8 -*-
"""
KickWatch - Spielplan-Abruf ueber API-Football (api-sports.io)

Testphase: ruft die naechsten Spiele fuer eine feste Liste von Vereinen ab
und schreibt sie nach data/fixtures.json. Sobald Nutzerprofile (Firebase)
existieren, wird TEAMS hier durch die tatsaechlich von Nutzern favorisierten
Vereine ersetzt.

Benoetigt die Umgebungsvariable API_FOOTBALL_KEY (GitHub Actions Secret).
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

API_BASE = "https://v3.football.api-sports.io"
OUTPUT_FILE = Path(__file__).resolve().parent.parent / "data" / "fixtures.json"

# Testphase: Vereinsname -> wird zur Laufzeit per Suche in eine API-Football
# Team-ID aufgeloest (robuster als IDs hart zu codieren).
TEAMS = [
    "VfB Stuttgart",
]

SEASON = 2026  # Saison 2026/27
NEXT_N_FIXTURES = 5


def api_get(path: str, params: dict, api_key: str) -> dict:
    resp = requests.get(
        f"{API_BASE}{path}",
        headers={"x-apisports-key": api_key},
        params=params,
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("errors"):
        print(f"[WARN] API meldet Fehler fuer {path} {params}: {data['errors']}", file=sys.stderr)
    return data


def find_team_id(team_name: str, api_key: str):
    data = api_get("/teams", {"search": team_name}, api_key)
    results = data.get("response", [])
    if not results:
        print(f"[WARN] Kein Team gefunden fuer '{team_name}'", file=sys.stderr)
        return None
    # Ersten Treffer nehmen; bei mehrdeutigen Namen spaeter Auswahl anbieten.
    team = results[0]["team"]
    print(f"[INFO] '{team_name}' -> Team-ID {team['id']} ({team['name']}, {team.get('country')})")
    return team["id"]


def fetch_upcoming_fixtures(team_id: int, api_key: str) -> list:
    # Der "next"-Parameter ist im Free Plan von API-Football gesperrt, daher
    # holen wir den kompletten Saisonplan und filtern clientseitig auf
    # kommende Spiele.
    data = api_get("/fixtures", {"team": team_id, "season": SEASON}, api_key)
    all_matches = data.get("response", [])
    now = datetime.now(timezone.utc)
    upcoming = [
        m for m in all_matches
        if datetime.fromisoformat(m["fixture"]["date"]) > now
    ]
    upcoming.sort(key=lambda m: m["fixture"]["date"])
    return upcoming[:NEXT_N_FIXTURES]


def to_fixture_dict(raw: dict) -> dict:
    fixture = raw["fixture"]
    teams = raw["teams"]
    league = raw["league"]
    return {
        "homeTeam": teams["home"]["name"],
        "awayTeam": teams["away"]["name"],
        "kickoffUtc": fixture["date"],
        "competition": f"{league['name']} ({league.get('round', '')})".strip(),
        "venue": (fixture.get("venue") or {}).get("name"),
    }


def main():
    api_key = os.environ.get("API_FOOTBALL_KEY")
    if not api_key:
        print("[ERROR] API_FOOTBALL_KEY ist nicht gesetzt.", file=sys.stderr)
        sys.exit(1)

    all_fixtures = []
    for team_name in TEAMS:
        team_id = find_team_id(team_name, api_key)
        if team_id is None:
            continue
        raw_fixtures = fetch_upcoming_fixtures(team_id, api_key)
        print(f"[INFO] {team_name}: {len(raw_fixtures)} kommende Spiele gefunden")
        all_fixtures.extend(to_fixture_dict(f) for f in raw_fixtures)

    all_fixtures.sort(key=lambda f: f["kickoffUtc"])
    OUTPUT_FILE.write_text(json.dumps(all_fixtures, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] {len(all_fixtures)} Spiele geschrieben nach {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
