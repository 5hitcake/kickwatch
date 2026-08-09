const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";

let localTeamsPromise = null;

function loadLocalTeams() {
  if (!localTeamsPromise) {
    localTeamsPromise = fetch("data/teams.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  return localTeamsPromise;
}

function normalize(s) {
  return (s || "").toLowerCase();
}

async function searchLocalTeams(query) {
  const teams = await loadLocalTeams();
  const q = normalize(query);
  return teams
    .filter((t) => normalize(t.name).includes(q) || normalize(t.shortName).includes(q))
    .slice(0, 8)
    .map((t) => ({ name: t.name, country: t.country, league: t.competition }));
}

async function searchTsdb(query) {
  try {
    const resp = await fetch(`${TSDB_BASE}/searchteams.php?t=${encodeURIComponent(query)}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    const teams = data.teams || [];
    return teams.slice(0, 8).map((t) => ({
      name: t.strTeam,
      country: t.strCountry,
      league: t.strLeague,
    }));
  } catch {
    return [];
  }
}

export async function searchTeams(query) {
  const q = query.trim();
  if (q.length < 3) return [];

  // Grosse, bekannte Ligen zuerst (verlaessliche offizielle Namen).
  const local = await searchLocalTeams(q);
  if (local.length) return local;

  // Fallback: weltweite Abdeckung ausserhalb der grossen Ligen.
  return searchTsdb(q);
}
