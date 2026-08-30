import { initAuthUI } from "./auth.js";
import { loadFavoriteTeams, saveFavoriteTeams, ensureCalendarToken, enableMatchReminders } from "./favorites.js";
import { searchTeams, fetchTeamFixturesPreview } from "./team-search.js";
import { messagingSupportedPromise, getMessagingInstance, onMessage } from "./firebase-init.js";
import { getBroadcasterInfo } from "./broadcasters.js";

let swRegistration = null;
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      swRegistration = await navigator.serviceWorker.register("service-worker.js");
    } catch (err) {
      console.warn("Service worker registration failed:", err);
    }
  });
}

// Wenn die App gerade offen/im Vordergrund ist, kommen Push-Nachrichten
// nicht automatisch als System-Benachrichtigung an (das macht der Service
// Worker nur im Hintergrund) - hier stattdessen selbst anzeigen.
messagingSupportedPromise.then((supported) => {
  if (!supported) return;
  onMessage(getMessagingInstance(), (payload) => {
    const title = (payload.notification && payload.notification.title) || "KickWatch";
    const body = (payload.notification && payload.notification.body) || "";
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "icons/icon.svg" });
    }
  });
});

let currentUid = null;
let favoriteTeams = [];
let rawFixtures = [];
let activeFilterTeam = null; // null = "Alle" (naechste 3 ueber alle Favoriten)
const NEXT_N_COMBINED = 3;
const NEXT_N_SINGLE_TEAM = 10;

const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const logoutBtn = document.getElementById("logout-btn");
const userEmailLabel = document.getElementById("user-email");
const favoritesList = document.getElementById("favorites-list");
const addFavoriteForm = document.getElementById("add-favorite-form");
const addFavoriteInput = document.getElementById("add-favorite-input");
const favoriteSuggestions = document.getElementById("favorite-suggestions");
const favoriteDebug = document.getElementById("favorite-debug");
const fixtureFilter = document.getElementById("fixture-filter");
const fixturesHeading = document.getElementById("fixtures-heading");
const calendarLinkBtn = document.getElementById("calendar-link-btn");
const calendarLinkBox = document.getElementById("calendar-link-box");
const calendarGoogleLink = document.getElementById("calendar-google-link");
const calendarWebcalLink = document.getElementById("calendar-webcal-link");
const calendarLinkInput = document.getElementById("calendar-link-input");
const calendarCopyBtn = document.getElementById("calendar-copy-btn");
const calendarCopyStatus = document.getElementById("calendar-copy-status");
const remindersBtn = document.getElementById("reminders-btn");
const remindersStatus = document.getElementById("reminders-status");

// Zeigt den aktuellen Schritt direkt auf der Seite an (kein Entwicklertools
// noetig, um auf dem Handy nachzuvollziehen, was das Skript gerade tut).
function debugStatus(msg) {
  console.log("[KickWatch]", msg);
  if (favoriteDebug) favoriteDebug.textContent = msg;
}

async function onLogin(user) {
  currentUid = user.uid;
  authScreen.hidden = true;
  appScreen.hidden = false;
  logoutBtn.hidden = false;
  userEmailLabel.textContent = user.email || user.displayName || "";

  favoriteTeams = await loadFavoriteTeams(currentUid);
  renderFavorites();
  rawFixtures = await loadFixtures();
  refreshFixturesView();
}

function onLogout() {
  currentUid = null;
  favoriteTeams = [];
  rawFixtures = [];
  activeFilterTeam = null;
  authScreen.hidden = false;
  appScreen.hidden = true;
  logoutBtn.hidden = true;

  // Zustand des vorherigen Kontos nicht stehen lassen - sonst sieht ein
  // zweites Konto auf demselben Geraet sonst kurz den alten Kalender-Link
  // oder Debug-Text, bevor es selbst etwas hinzufuegt.
  hideSuggestions();
  addFavoriteInput.value = "";
  debugStatus("");
  calendarLinkBox.hidden = true;
  calendarLinkInput.value = "";
  calendarGoogleLink.href = "#";
  calendarWebcalLink.href = "#";
  calendarCopyStatus.textContent = "";
  remindersStatus.textContent = "";
}

function renderFavorites() {
  if (!favoriteTeams.length) {
    favoritesList.innerHTML = `<p class="meta">Noch keine Vereine gespeichert.</p>`;
    return;
  }
  favoritesList.innerHTML = favoriteTeams
    .map(
      (team, i) => `
      <span class="chip">
        <span class="chip-check" aria-hidden="true">&#10003;</span>
        ${team}
        <button type="button" class="chip-remove" data-index="${i}" aria-label="Entfernen">&times;</button>
      </span>`
    )
    .join("");

  favoritesList.querySelectorAll(".chip-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const index = Number(btn.dataset.index);
      favoriteTeams.splice(index, 1);
      renderFavorites();
      refreshFixturesView();
      await saveFavoriteTeams(currentUid, favoriteTeams);
    });
  });
}

async function addFavorite(team) {
  debugStatus(`addFavorite() aufgerufen mit: "${team}"`);
  if (!team) {
    debugStatus("Abgebrochen: leerer Name");
    return;
  }
  if (favoriteTeams.some((t) => normalizeTeamName(t) === normalizeTeamName(team))) {
    debugStatus(`Abgebrochen: "${team}" ist bereits in der Liste`);
    return;
  }
  favoriteTeams.push(team);
  addFavoriteInput.value = "";
  hideSuggestions();
  renderFavorites();
  refreshFixturesView();
  debugStatus(`"${team}" lokal hinzugefuegt, speichere jetzt online...`);
  try {
    await saveFavoriteTeams(currentUid, favoriteTeams);
    debugStatus(`"${team}" erfolgreich gespeichert.`);
  } catch (err) {
    debugStatus(`Fehler beim Speichern von "${team}": ${err && err.message ? err.message : err}`);
  }

  // Nicht auf den taeglichen Server-Abruf warten: sofort eine Vorschau der
  // naechsten Spiele fuer den neuen Verein laden, damit er direkt in der
  // Uebersicht auftaucht statt erst bis zu 24 Stunden spaeter.
  const preview = await fetchTeamFixturesPreview(team);
  if (preview.length) {
    mergeFixtures(preview);
    refreshFixturesView();
    debugStatus(`"${team}" erfolgreich gespeichert. ${preview.length} Spiel(e) als Vorschau geladen.`);
  }
}

// Kalendertag + Vereinsname (Heim ODER Auswaerts) statt exaktem
// Team-Paar-Vergleich: kein Verein spielt zweimal am selben Tag, daher
// reicht es, wenn EINE Seite an dem Tag schon bekannt ist. Robuster als
// ein Vergleich beider Namen, falls die Sofort-Vorschau (TheSportsDB) und
// der spaetere Server-Abruf (football-data.org) denselben Verein leicht
// unterschiedlich schreiben (z.B. "VfB Stuttgart" vs. "Stuttgart").
function teamDayKeys(f) {
  const day = (f.kickoffUtc || "").slice(0, 10);
  return [`${day}::${normalizeTeamName(f.homeTeam)}`, `${day}::${normalizeTeamName(f.awayTeam)}`];
}

function mergeFixtures(newFixtures) {
  const seen = new Set(rawFixtures.flatMap(teamDayKeys));
  for (const f of newFixtures) {
    const [homeKey, awayKey] = teamDayKeys(f);
    if (seen.has(homeKey) || seen.has(awayKey)) continue;
    rawFixtures.push(f);
    seen.add(homeKey);
    seen.add(awayKey);
  }
  rawFixtures.sort((a, b) => (a.kickoffUtc || "").localeCompare(b.kickoffUtc || ""));
}

// Speichert immer genau das, was eingetippt wurde, wenn per Button/Enter
// bestaetigt wird (kein Vorschlag ausgewaehlt).
async function submitTypedTeam() {
  await addFavorite(addFavoriteInput.value.trim());
}

addFavoriteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitTypedTeam();
});

// Manche mobilen Tastaturen (z.B. mit "Öffnen"/"Los" statt "Weiter"/"Fertig"
// beschriftet) loesen kein zuverlaessiges natives submit-Event aus. Enter
// wird deshalb zusaetzlich direkt abgefangen.
addFavoriteInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitTypedTeam();
  }
});

function hideSuggestions() {
  favoriteSuggestions.hidden = true;
  favoriteSuggestions.innerHTML = "";
}

function renderSuggestions(teams) {
  debugStatus(`Vorschlagsliste: ${teams.length} Treffer`);
  if (!teams.length) {
    hideSuggestions();
    return;
  }
  favoriteSuggestions.innerHTML = teams
    .map(
      (t, i) => `
      <button type="button" class="suggestion-item" data-index="${i}">
        ${t.name}
        <div class="suggestion-meta">${[t.league, t.country].filter(Boolean).join(" · ")}</div>
      </button>`
    )
    .join("");
  favoriteSuggestions.hidden = false;

  favoriteSuggestions.querySelectorAll(".suggestion-item").forEach((btn) => {
    // pointerdown statt click: feuert VOR blur/Ausblenden des Suchfelds,
    // damit der Tap auf einen Vorschlag auch dann ankommt, wenn ein
    // Blur-bedingtes Schliessen der Liste sonst schneller waere als das
    // click-Event auf mobilen Browsern.
    btn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const team = teams[Number(btn.dataset.index)];
      debugStatus(`Vorschlag angetippt: "${team.name}"`);
      addFavorite(team.name);
    });
  });
}

let searchDebounce;
addFavoriteInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  const query = addFavoriteInput.value;
  debugStatus(`Eingabe: "${query}" - suche...`);
  searchDebounce = setTimeout(async () => {
    const teams = await searchTeams(query);
    renderSuggestions(teams);
  }, 300);
});

// Vorschlagsliste nur schliessen, wenn ausserhalb von Eingabefeld und Liste
// getippt/geklickt wird.
document.addEventListener("click", (event) => {
  if (event.target === addFavoriteInput || favoriteSuggestions.contains(event.target)) return;
  hideSuggestions();
});

async function loadFixtures() {
  try {
    const res = await fetch("data/fixtures.json", { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function formatKickoff(isoString) {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Entfernt Umlaute/Akzente und Gross-/Kleinschreibung, damit z.B. "koeln"
// oder "real madrid" (wie eingetippt) auf "1. FC Köln" bzw. "Real Madrid CF"
// (offizielle Namen aus den Spieldaten) matchen.
function normalizeTeamName(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function teamMatches(favorite, teamName) {
  const f = normalizeTeamName(favorite);
  const t = normalizeTeamName(teamName);
  if (!f || !t) return false;
  return t.includes(f) || f.includes(t);
}

function filterFixturesForFavorites(fixtures) {
  if (!favoriteTeams.length) return [];
  return fixtures.filter((f) =>
    favoriteTeams.some((fav) => teamMatches(fav, f.homeTeam) || teamMatches(fav, f.awayTeam))
  );
}

// Wenn der aktuell gefilterte Verein aus den Favoriten entfernt wurde,
// zurueck auf "Alle" springen statt eine leere/ungueltige Auswahl zu zeigen.
function ensureValidFilter() {
  if (activeFilterTeam && !favoriteTeams.includes(activeFilterTeam)) {
    activeFilterTeam = null;
  }
}

function renderFixtureFilter() {
  if (!favoriteTeams.length) {
    fixtureFilter.innerHTML = "";
    return;
  }
  const pills = [{ label: "Alle", team: null }, ...favoriteTeams.map((t) => ({ label: t, team: t }))];
  fixtureFilter.innerHTML = pills
    .map(
      (p, i) => `
      <button type="button" class="filter-pill${p.team === activeFilterTeam ? " active" : ""}" data-index="${i}">
        ${p.label}
      </button>`
    )
    .join("");

  fixtureFilter.querySelectorAll(".filter-pill").forEach((btn, i) => {
    btn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      activeFilterTeam = pills[i].team;
      refreshFixturesView();
    });
  });
}

function refreshFixturesView() {
  ensureValidFilter();
  renderFixtureFilter();

  let fixtures = filterFixturesForFavorites(rawFixtures);
  if (activeFilterTeam) {
    fixtures = fixtures.filter(
      (f) => teamMatches(activeFilterTeam, f.homeTeam) || teamMatches(activeFilterTeam, f.awayTeam)
    );
    fixturesHeading.textContent = `Alle Spiele: ${activeFilterTeam}`;
    fixtures = fixtures.slice(0, NEXT_N_SINGLE_TEAM);
  } else {
    fixturesHeading.textContent = "Nächste Spiele";
    fixtures = fixtures.slice(0, NEXT_N_COMBINED);
  }

  renderFixtures(fixtures);
}

function renderFixtures(fixtures) {
  const container = document.getElementById("fixtures-list");
  if (!favoriteTeams.length) {
    container.innerHTML = `<div class="empty-state"><p>Füge oben einen Verein hinzu, um hier seine Spiele zu sehen.</p></div>`;
    return;
  }
  if (!fixtures.length) {
    container.innerHTML = `<div class="empty-state"><p>Für deine gespeicherten Vereine sind noch keine Spiele hinterlegt. Der automatische Abruf läuft einmal täglich.</p></div>`;
    return;
  }

  container.innerHTML = fixtures
    .map((f) => {
      const broadcaster = getBroadcasterInfo(f.competition);
      return `
      <div class="card">
        <div class="club">${f.homeTeam} - ${f.awayTeam}</div>
        <div class="meta">${formatKickoff(f.kickoffUtc)} (deine Zeitzone) - ${f.competition}</div>
        ${broadcaster ? `<div class="meta broadcaster">📺 ${broadcaster}</div>` : ""}
      </div>`;
    })
    .join("");
}

calendarLinkBtn.addEventListener("click", async () => {
  calendarLinkBtn.disabled = true;
  calendarLinkBtn.textContent = "Lade...";
  try {
    const token = await ensureCalendarToken(currentUid);
    const basePath = location.pathname.replace(/index\.html$/, "").replace(/\/$/, "");
    const url = `${location.origin}${basePath}/data/calendar/${token}.ics`;
    // Google Kalender akzeptiert eine ICS-URL direkt als "cid"-Parameter
    // und zeigt dann sofort den "Kalender abonnieren"-Dialog - zuverlaessiger
    // als webcal:// auf Android/Samsung, wo oft keine App als Handler dafuer
    // registriert ist.
    calendarGoogleLink.href = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(url)}`;
    // webcal:// als Alternative (funktioniert v.a. auf iOS zuverlaessig).
    calendarWebcalLink.href = url.replace(/^https?:\/\//, "webcal://");
    calendarLinkInput.value = url;
    calendarLinkBox.hidden = false;
    calendarCopyStatus.textContent = "";
  } finally {
    calendarLinkBtn.disabled = false;
    calendarLinkBtn.textContent = "Zum Kalender hinzufügen";
  }
});

calendarCopyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(calendarLinkInput.value);
    calendarCopyStatus.textContent = "Link kopiert!";
  } catch {
    calendarLinkInput.select();
    calendarCopyStatus.textContent = "Bitte manuell kopieren (Text ist markiert).";
  }
});

remindersBtn.addEventListener("click", async () => {
  remindersBtn.disabled = true;
  remindersStatus.textContent = "";
  try {
    await enableMatchReminders(currentUid, swRegistration);
    remindersStatus.textContent = "Erinnerungen aktiviert - du bekommst ca. 60 Minuten vor Anstoss eine Benachrichtigung.";
  } catch (err) {
    remindersStatus.textContent = `Fehler: ${err.message}`;
  } finally {
    remindersBtn.disabled = false;
  }
});

initAuthUI({ onLogin, onLogout });
