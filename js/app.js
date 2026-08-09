import { initAuthUI } from "./auth.js";
import { loadFavoriteTeams, saveFavoriteTeams } from "./favorites.js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}

let currentUid = null;
let favoriteTeams = [];

const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const logoutBtn = document.getElementById("logout-btn");
const userEmailLabel = document.getElementById("user-email");
const favoritesList = document.getElementById("favorites-list");
const addFavoriteForm = document.getElementById("add-favorite-form");
const addFavoriteInput = document.getElementById("add-favorite-input");

async function onLogin(user) {
  currentUid = user.uid;
  authScreen.hidden = true;
  appScreen.hidden = false;
  logoutBtn.hidden = false;
  userEmailLabel.textContent = user.email || user.displayName || "";

  favoriteTeams = await loadFavoriteTeams(currentUid);
  renderFavorites();
  loadFixtures().then(renderFixtures);
}

function onLogout() {
  currentUid = null;
  favoriteTeams = [];
  authScreen.hidden = false;
  appScreen.hidden = true;
  logoutBtn.hidden = true;
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
      await saveFavoriteTeams(currentUid, favoriteTeams);
    });
  });
}

addFavoriteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const team = addFavoriteInput.value.trim();
  if (!team || favoriteTeams.includes(team)) return;
  favoriteTeams.push(team);
  addFavoriteInput.value = "";
  renderFavorites();
  await saveFavoriteTeams(currentUid, favoriteTeams);
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

function renderFixtures(fixtures) {
  const container = document.getElementById("fixtures-list");
  if (!fixtures.length) {
    container.innerHTML = `<div class="empty-state"><p>Noch keine Spiele geladen.</p></div>`;
    return;
  }

  container.innerHTML = fixtures
    .map(
      (f) => `
      <div class="card">
        <div class="club">${f.homeTeam} - ${f.awayTeam}</div>
        <div class="meta">${formatKickoff(f.kickoffUtc)} (deine Zeitzone) - ${f.competition}</div>
      </div>`
    )
    .join("");
}

initAuthUI({ onLogin, onLogout });
