# -*- coding: utf-8 -*-
"""
KickWatch - Vereinsliste der grossen Ligen (football-data.org) fuer die
Autocomplete-Suche im Frontend.

Wird separat von fetch_fixtures.py gepflegt, weil hier ALLE Vereine der
abgedeckten Wettbewerbe gebraucht werden (nicht nur die aktuell favorisierten).
Ergebnis: data/teams.json - dient der Suche als bevorzugte, verlaessliche
Quelle fuer bekannte Vereine (korrekte offizielle Namen). TheSportsDB bleibt
im Frontend der Fallback fuer alles, was hier nicht auftaucht.
"""

import json
import os
import sys
import time
from pathlib import Path

import requests

FD_BASE = "https://api.football-data.org/v4"
FD_COMPETITIONS = [
    "BL1", "PL", "PD", "SA", "FL1", "CL", "DED", "PPL", "ELC", "BSA", "CLI",
]
OUTPUT_FILE = Path(__file__).resolve().parent.parent / "data" / "teams.json"


def main():
    api_key = os.environ.get("FOOTBALL_DATA_API_KEY")
    if not api_key:
        print("[WARN] Kein FOOTBALL_DATA_API_KEY gesetzt, ueberspringe Vereinsliste.", file=sys.stderr)
        OUTPUT_FILE.write_text("[]", encoding="utf-8")
        return

    teams_by_id = {}
    for code in FD_COMPETITIONS:
        resp = requests.get(
            f"{FD_BASE}/competitions/{code}/teams",
            headers={"X-Auth-Token": api_key},
            timeout=20,
        )
        if resp.status_code != 200:
            print(f"[WARN] {code}: Status {resp.status_code}, uebersprungen", file=sys.stderr)
            time.sleep(6.5)
            continue

        data = resp.json()
        comp_name = data.get("competition", {}).get("name", code)
        for t in data.get("teams", []):
            teams_by_id[t["id"]] = {
                "name": t["name"],
                "shortName": t.get("shortName"),
                "country": (t.get("area") or {}).get("name"),
                "competition": comp_name,
            }
        print(f"[INFO] {code}: {len(data.get('teams', []))} Vereine geladen")
        time.sleep(6.5)  # Free-Tier-Limit: 10 Anfragen/Minute

    teams = sorted(teams_by_id.values(), key=lambda t: t["name"])
    OUTPUT_FILE.write_text(json.dumps(teams, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] {len(teams)} Vereine geschrieben nach {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
