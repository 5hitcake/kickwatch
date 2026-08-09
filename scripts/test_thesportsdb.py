# -*- coding: utf-8 -*-
"""
Einmaliger Test: liefert TheSportsDB (kostenloser Test-Key '3') aktuelle
Spielplandaten fuer VfB Stuttgart? Kein Secret noetig, da der oeffentliche
Test-Key ohne Registrierung nutzbar ist.
"""

import requests

BASE = "https://www.thesportsdb.com/api/v1/json/3"


def main():
    r = requests.get(f"{BASE}/searchteams.php", params={"t": "VfB Stuttgart"}, timeout=20)
    r.raise_for_status()
    teams = r.json().get("teams") or []
    print(f"[INFO] searchteams Status {r.status_code}, {len(teams)} Treffer")
    if not teams:
        print("[WARN] Kein Team gefunden.")
        return

    team = teams[0]
    team_id = team["idTeam"]
    print(f"[INFO] Team gefunden: {team['strTeam']} (ID {team_id})")

    r2 = requests.get(f"{BASE}/eventsnext.php", params={"id": team_id}, timeout=20)
    r2.raise_for_status()
    print(f"[INFO] eventsnext Status {r2.status_code}")
    events = r2.json().get("events") or []
    print(f"[INFO] {len(events)} kommende Spiele gefunden")
    for e in events:
        print(f"  - {e.get('dateEvent')} {e.get('strTime')} UTC: {e.get('strHomeTeam')} vs {e.get('strAwayTeam')} ({e.get('strLeague')})")


if __name__ == "__main__":
    main()
