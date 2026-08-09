const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";

export async function searchTeams(query) {
  const q = query.trim();
  if (q.length < 3) return [];

  try {
    const resp = await fetch(`${TSDB_BASE}/searchteams.php?t=${encodeURIComponent(q)}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    const teams = data.teams || [];
    return teams.slice(0, 8).map((t) => ({
      id: t.idTeam,
      name: t.strTeam,
      country: t.strCountry,
      league: t.strLeague,
    }));
  } catch {
    return [];
  }
}
