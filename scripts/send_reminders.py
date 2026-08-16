# -*- coding: utf-8 -*-
"""
KickWatch - schickt Push-Erinnerungen (Firebase Cloud Messaging) rund
60 Minuten vor Anstoss eines gespeicherten Lieblingsvereins.

Laeuft alle 15 Minuten (siehe .github/workflows/send-reminders.yml) und
prueft pro Nutzer, ob eines seiner Spiele gerade in den Erinnerungs-
Zeitraum faellt. Gegen Doppel-Benachrichtigungen wird jedes bereits
benachrichtigte Spiel in Firestore vermerkt (notifiedMatches).
"""

import json
import os
import sys
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

REMINDER_LEAD_MINUTES = 60
# Toleranzfenster um die Lead-Zeit herum, damit bei einem 15-Minuten-Cron
# (der auf GitHub Actions nicht sekundengenau laeuft) kein Spiel durchrutscht.
WINDOW_MINUTES = 20

FIXTURES_FILE = Path(__file__).resolve().parent.parent / "data" / "fixtures.json"


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


def match_key(f: dict) -> str:
    day = (f.get("kickoffUtc") or "")[:10]
    home = normalize_team_name(f.get("homeTeam"))
    away = normalize_team_name(f.get("awayTeam"))
    return f"{day}::{home}::{away}"


def due_fixtures_for_user(fixtures: list, favorite_teams: list, notified_keys: set, now: datetime) -> list:
    due = []
    for f in fixtures:
        kickoff_raw = f.get("kickoffUtc")
        if not kickoff_raw:
            continue
        try:
            kickoff = datetime.strptime(kickoff_raw, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        except ValueError:
            continue

        minutes_until = (kickoff - now).total_seconds() / 60
        low = REMINDER_LEAD_MINUTES - WINDOW_MINUTES / 2
        high = REMINDER_LEAD_MINUTES + WINDOW_MINUTES / 2
        if not (low <= minutes_until <= high):
            continue

        key = match_key(f)
        if key in notified_keys:
            continue

        if any(
            team_matches(fav, f.get("homeTeam", "")) or team_matches(fav, f.get("awayTeam", ""))
            for fav in favorite_teams
        ):
            due.append((key, f))
    return due


def main():
    creds_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if not creds_json:
        print("[WARN] Kein FIREBASE_SERVICE_ACCOUNT gesetzt, ueberspringe Erinnerungen.", file=sys.stderr)
        return
    if not FIXTURES_FILE.exists():
        print("[WARN] data/fixtures.json nicht gefunden.", file=sys.stderr)
        return

    import firebase_admin
    from firebase_admin import credentials, firestore, messaging

    if not firebase_admin._apps:
        cred = credentials.Certificate(json.loads(creds_json))
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    fixtures = json.loads(FIXTURES_FILE.read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc)
    cutoff_day = (now - timedelta(days=2)).strftime("%Y-%m-%d")

    sent_count = 0
    for doc in db.collection("users").stream():
        data = doc.to_dict() or {}
        tokens = data.get("fcmTokens") or []
        favorite_teams = [t for t in data.get("favoriteTeams", []) if t]
        if not tokens or not favorite_teams:
            continue

        # Alte Eintraege (Spiele, die laengst vorbei sind) rausfiltern,
        # damit das Feld nicht unbegrenzt waechst.
        notified_keys = {k for k in (data.get("notifiedMatches") or []) if k.split("::", 1)[0] >= cutoff_day}

        due = due_fixtures_for_user(fixtures, favorite_teams, notified_keys, now)
        if not due:
            if notified_keys != set(data.get("notifiedMatches") or []):
                doc.reference.set({"notifiedMatches": sorted(notified_keys)}, merge=True)
            continue

        valid_tokens = list(tokens)
        for key, fixture in due:
            title = f"{fixture['homeTeam']} - {fixture['awayTeam']}"
            body = f"Beginnt in ca. {REMINDER_LEAD_MINUTES} Minuten ({fixture.get('competition', '')})"
            for token in list(valid_tokens):
                try:
                    messaging.send(
                        messaging.Message(
                            token=token,
                            notification=messaging.Notification(title=title, body=body),
                        )
                    )
                    sent_count += 1
                except messaging.UnregisteredError:
                    valid_tokens.remove(token)
                except Exception as exc:  # noqa: BLE001 - ein fehlerhafter Token soll nicht den ganzen Lauf stoppen
                    print(f"[WARN] Push an Token fehlgeschlagen ({exc})", file=sys.stderr)
            notified_keys.add(key)
            print(f"[INFO] Erinnerung gesendet: {title} an Nutzer {doc.id}")

        update = {"notifiedMatches": sorted(notified_keys)}
        if valid_tokens != tokens:
            update["fcmTokens"] = valid_tokens
        doc.reference.set(update, merge=True)

    print(f"[OK] {sent_count} Push-Benachrichtigung(en) verschickt.")


if __name__ == "__main__":
    main()
