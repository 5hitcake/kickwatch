# KickWatch

Weltweite Fußball-App: Verfolge deine Lieblingsvereine, sieh auf einen Blick,
wann sie spielen (automatisch in deiner Zeitzone) und wo die Spiele übertragen
werden – mit Login (Pflicht) zum dauerhaften Speichern deiner Vereine und
späterem Kalender-Sync.

## Status

🚧 Im Aufbau. Aktueller Stand: Login (Google + E-Mail-Link) und Lieblingsvereine
speichern funktionieren. Der Spielplan zeigt noch Testdaten für einen festen
Verein, nicht die tatsächlich gespeicherten Favoriten (folgt als nächstes).

## Geplanter Funktionsumfang

- [x] Login (Google oder passwortloser E-Mail-Link, via Firebase Auth) – Pflicht
- [x] Mehrere Lieblingsvereine speichern (Firestore, pro Nutzer)
- [ ] Spielplan tatsächlich nach den gespeicherten Lieblingsvereinen filtern
- [ ] Nächste Spiele automatisch in der Zeitzone des Nutzers anzeigen
- [ ] Übertragungsinfo (TV/Stream) pro Land, wo verfügbar
- [ ] Kalender-Sync (ICS-Export, optional direkter Google-Calendar-Push)
- [ ] Live-Ticker / Statistiken (spätere Ausbaustufe)

## Tech-Stack

- **Frontend**: Statisches PWA (HTML/CSS/JS, kein Build-Prozess), gehostet über GitHub Pages
- **Spieldaten**: zweistufig, täglich per GitHub Actions abgerufen und als statische JSON-Datei im Repo abgelegt.
  1. [football-data.org](https://www.football-data.org/) (kostenloser Key, Secret `FOOTBALL_DATA_API_KEY`) – zuverlässige, offizielle Daten für die großen Wettbewerbe (Top-5-Ligen Europas, Champions League u. a.).
  2. [TheSportsDB](https://www.thesportsdb.com/) (kostenloser Test-Key, kein Secret nötig) – Fallback für alle Vereine außerhalb dieser großen Wettbewerbe.

  (API-Football wurde ebenfalls getestet, aber der Free Plan blockiert die aktuelle Saison komplett – Wechsel dorthin ist später gegen 19 $/Monat möglich, falls beide aktuellen Quellen nicht ausreichen.)
- **Nutzerkonten & Lieblingsvereine**: Firebase Auth (Google + E-Mail-Link) + Firestore. Firebase-Projekt: `kickwatxh`.
  - Login ist Pflicht (kein Browsen ohne Konto).
  - Firestore-Sicherheitsregeln (in der Firebase-Konsole unter Firestore Database → Regeln eintragen):
    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /users/{userId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
    }
    ```
  - Autorisierte Domain: `5hitcake.github.io` muss unter Authentication → Settings → Authorized domains eingetragen sein, sonst schlägt der Google-Redirect fehl.
- **Kalender-Sync**: ICS-Export (wie im Schwesterprojekt [vfb-calendar](https://github.com/5hitcake/vfb-calendar)), optional Google-Calendar-API

## Lokal ansehen

Da es (noch) kein Build-Tool gibt, reicht ein einfacher lokaler Webserver:

```bash
python3 -m http.server 8000
# dann im Browser: http://localhost:8000
```

## Projektstruktur

```
index.html          Einstiegspunkt der PWA
manifest.json        PWA-Manifest (App-Name, Icons, Theme)
service-worker.js     Offline-Fähigkeit / Installierbarkeit
css/style.css         Styles
js/app.js             App-Logik (Auth-Gate, Favoriten-UI, Spielplan-Anzeige)
js/auth.js            Login-UI-Logik (Google-Popup, E-Mail-Link)
js/favorites.js        Firestore-Zugriff für Lieblingsvereine
js/firebase-init.js    Firebase SDK Initialisierung
js/firebase-config.js  Firebase-Projektkonfiguration (öffentlich, kein Geheimnis)
icons/                App-Icons
data/                 Generierte Spielplan-Daten (per GitHub Actions befüllt)
.github/workflows/    Automatisierung (täglicher Datenabruf)
```
