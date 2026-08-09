if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}

document.getElementById("login-btn").addEventListener("click", () => {
  alert("Login kommt in einem der nächsten Schritte (Google-Login via Firebase).");
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
  if (!fixtures.length) return;

  container.innerHTML = fixtures
    .map(
      (f) => `
      <div class="card">
        <div class="club">${f.homeTeam} - ${f.awayTeam}</div>
        <div class="meta">${formatKickoff(f.kickoffUtc)} (deine Zeitzone) · ${f.competition}</div>
      </div>`
    )
    .join("");
}

loadFixtures().then(renderFixtures);
