# -*- coding: utf-8 -*-
"""
KickWatch - Spielplan-Abruf, geschichtet ueber zwei Quellen:

1. football-data.org: zuverlaessige, offizielle Daten fuer die grossen
   Wettbewerbe (Top-5-Ligen Europas, Champions League etc.). Braucht einen
   kostenlosen API-Key (Secret FOOTBALL_DATA_API_KEY).
2. TheSportsDB: Fallback fuer alle Vereine, die football-data.org nicht
   abdeckt (kleinere Ligen/Vereine weltweit). Kostenloser Test-Key, kein
   Secret noetig.

Pro Verein wird zuerst football-data.org versucht; nur wenn der Verein dort
in keinem der bekannten Wettbewerbe gefunden wird, springt der Fallback auf
TheSportsDB ein. So gibt es keine doppelten Eintraege aus beiden Quellen.

Die Liste der Vereine kommt aus den tatsaechlich von Nutzern gespeicherten
Lieblingsvereinen (siehe firestore_favorites.py), mit Fallback auf eine
Standardliste, falls Firestore nicht erreichbar ist oder noch niemand
Favoriten gespeichert hat.
"""

import json
import os
import sys
import time
from pathlib import Path

import requests

from firestore_favorites import get_favorite_teams

NEXT_N_FIXTURES = 5
OUTPUT_FILE = Path(__file__).resolve().parent.parent / "data" / "fixtures.json"

# --- football-data.org --------------------------------------------------

FD_BASE = "https://api.football-data.org/v4"

# Kostenlos zugaengliche Wettbewerbe im Free-Tier von football-data.org.
FD_COMPETITIONS = [
    "BL1",  # Bundesliga
    "PL",   # Premier League
    "PD",   # La Liga
    "SA",   # Serie A
    "FL1",  # Ligue 1
    "CL",   # Champions League
    "DED",  # Eredivisie
    "PPL",  # Primeira Liga
    "ELC",  # Championship
    "BSA",  # Campeonato Brasileiro Serie A
    "CLI",  # Copa Libertadores
]


def fd_get(path: str, api_key: str, params: dict | None = None):
    resp = requests.get(
        f"{FD_BASE}{path}",
        headers={"X-Auth-Token": api_key},
        params=params or {},
        timeout=20,
    )
    if resp.status_code in (403, 404, 429):
        return None
    resp.raise_for_status()
    return resp.json()


def find_team_in_football_data(team_name: str, api_key: str):
    for code in FD_COMPETITIONS:
        data = fd_get(f"/competitions/{code}/teams", api_key)
        if data:
            for team in data.get("teams", []):
                name = team.get("name", "")
                short = team.get("shortName", "") or ""
                if team_name.lower() in name.lower() or team_name.lower() in short.lower():
                    return team["id"], name
        time.sleep(6.5)  # Free-Tier-Limit: 10 Anfragen/Minute
    return None, None


def fetch_football_data_fixtures(team_id: int, api_key: str) -> list:
    data = fd_get(f"/teams/{team_id}/matches", api_key, params={"status": "SCHEDULED"})
    if not data:
        return []
    matches = data.get("matches", [])
    matches.sort(key=lambda m: m["utcDate"])
    return matches[:NEXT_N_FIXTURES]


def to_fixture_dict_fd(m: dict) -> dict:
    return {
        "homeTeam": m["homeTeam"]["name"],
        "awayTeam": m["awayTeam"]["name"],
        "kickoffUtc": m["utcDate"],
        "competition": m["competition"]["name"],
        "venue": m.get("venue"),
    }


# --- TheSportsDB (Fallback) ----------------------------------------------

TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3"


def find_team_id_tsdb(team_name: str):
    resp = requests.get(f"{TSDB_BASE}/searchteams.php", params={"t": team_name}, timeout=20)
    resp.raise_for_status()
    teams = resp.json().get("teams") or []
    if not teams:
        return None, None
    team = teams[0]
    return team["idTeam"], team["strTeam"]


def fetch_tsdb_fixtures(team_id: str) -> list:
    resp = requests.get(f"{TSDB_BASE}/eventsnext.php", params={"id": team_id}, timeout=20)
    resp.raise_for_status()
    return resp.json().get("events") or []


def to_fixture_dict_tsdb(event: dict) -> dict:
    date = event.get("dateEvent")
    time_ = event.get("strTime") or "00:00:00"
    return {
        "homeTeam": event.get("strHomeTeam"),
        "awayTeam": event.get("strAwayTeam"),
        "kickoffUtc": f"{date}T{time_}Z" if date else None,
        "competition": event.get("strLeague") or "Freundschaftsspiel",
        "venue": event.get("strVenue"),
    }


# --- Orchestrierung --------------------------------------------------------


def fetch_team_fixtures(team_name: str, fd_api_key: str | None) -> list:
    if fd_api_key:
        fd_team_id, fd_team_name = find_team_in_football_data(team_name, fd_api_key)
        if fd_team_id:
            print(f"[INFO] '{team_name}' -> football-data.org: {fd_team_name} (ID {fd_team_id})")
            matches = fetch_football_data_fixtures(fd_team_id, fd_api_key)
            print(f"[INFO] {team_name}: {len(matches)} kommende Spiele (football-data.org)")
            return [to_fixture_dict_fd(m) for m in matches]
        print(f"[INFO] '{team_name}' in keinem football-data.org Top-Wettbewerb gefunden, Fallback auf TheSportsDB")
    else:
        print("[WARN] Kein FOOTBALL_DATA_API_KEY gesetzt, nutze nur TheSportsDB", file=sys.stderr)

    tsdb_id, tsdb_name = find_team_id_tsdb(team_name)
    if tsdb_id is None:
        print(f"[WARN] Kein Team gefunden fuer '{team_name}'", file=sys.stderr)
        return []
    print(f"[INFO] '{team_name}' -> TheSportsDB: {tsdb_name} (ID {tsdb_id})")
    events = fetch_tsdb_fixtures(tsdb_id)
    print(f"[INFO] {team_name}: {len(events)} kommende Spiele (TheSportsDB)")
    return [to_fixture_dict_tsdb(e) for e in events]


def main():
    fd_api_key = os.environ.get("FOOTBALL_DATA_API_KEY")
    teams = get_favorite_teams()

    all_fixtures = []
    for team_name in teams:
        all_fixtures.extend(fetch_team_fixtures(team_name, fd_api_key))

    all_fixtures = [f for f in all_fixtures if f.get("kickoffUtc")]
    all_fixtures.sort(key=lambda f: f["kickoffUtc"])
    OUTPUT_FILE.write_text(json.dumps(all_fixtures, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] {len(all_fixtures)} Spiele geschrieben nach {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
