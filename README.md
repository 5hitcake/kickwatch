# KickWatch

Weltweite Fußball-App: Verfolge deine Lieblingsvereine, sieh auf einen Blick,
wann sie spielen (automatisch in deiner Zeitzone) und wo die Spiele übertragen
werden – mit optionalem Google-Login zum dauerhaften Speichern deiner Vereine
und Kalender-Sync.

## Status

🚧 Im Aufbau. Aktueller Stand: PWA-Grundgerüst.

## Geplanter Funktionsumfang

- [ ] Mehrere Lieblingsvereine weltweit auswählen und speichern (Google-Login via Firebase)
- [ ] Nächste Spiele automatisch in der Zeitzone des Nutzers anzeigen
- [ ] Übertragungsinfo (TV/Stream) pro Land, wo verfügbar
- [ ] Kalender-Sync (ICS-Export, optional direkter Google-Calendar-Push)
- [ ] Live-Ticker / Statistiken (spätere Ausbaustufe)

## Tech-Stack

- **Frontend**: Statisches PWA (HTML/CSS/JS, kein Build-Prozess), gehostet über GitHub Pages
- **Spieldaten**: [API-Football](https://www.api-football.com/) (api-sports.io), täglich per GitHub Actions abgerufen und als statische JSON-Dateien im Repo abgelegt
- **Nutzerkonten & Lieblingsvereine**: Firebase (Google-Login + Firestore) – folgt in einem späteren Schritt
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
js/app.js             App-Logik
icons/                App-Icons
data/                 Generierte Spielplan-Daten (per GitHub Actions befüllt)
.github/workflows/    Automatisierung (täglicher Datenabruf)
```
