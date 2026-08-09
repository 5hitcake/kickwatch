# -*- coding: utf-8 -*-
"""
KickWatch - liest die gespeicherten Lieblingsvereine aller Nutzer aus
Firestore aus (fuer den taeglichen Spielplan-Abruf).

Braucht ein Firebase-Service-Konto (Secret FIREBASE_SERVICE_ACCOUNT, Inhalt
= komplettes JSON des privaten Schluessels). Ohne dieses Secret oder falls
noch keine Favoriten gespeichert sind, greift eine Standardliste, damit die
App nie komplett leer ist.
"""

import json
import os
import sys

DEFAULT_TEAMS = ["VfB Stuttgart"]


def get_favorite_teams() -> list:
    creds_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if not creds_json:
        print("[WARN] Kein FIREBASE_SERVICE_ACCOUNT gesetzt, nutze Standardliste.", file=sys.stderr)
        return DEFAULT_TEAMS

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            cred = credentials.Certificate(json.loads(creds_json))
            firebase_admin.initialize_app(cred)

        db = firestore.client()
        teams = set()
        for doc in db.collection("users").stream():
            for team in (doc.to_dict() or {}).get("favoriteTeams", []):
                if team:
                    teams.add(team)

        if not teams:
            print("[INFO] Keine gespeicherten Lieblingsvereine gefunden, nutze Standardliste.")
            return DEFAULT_TEAMS

        print(f"[INFO] {len(teams)} Lieblingsvereine aus Firestore geladen: {sorted(teams)}")
        return sorted(teams)
    except Exception as exc:  # noqa: BLE001 - bewusst breit, damit ein Firestore-Ausfall nie den ganzen Lauf blockiert
        print(f"[WARN] Firestore-Abruf fehlgeschlagen ({exc}), nutze Standardliste.", file=sys.stderr)
        return DEFAULT_TEAMS
