// Wettbewerbs-Ebene statt Spiel-Ebene: eine zuverlaessige, kostenlose API,
// die pro Spiel den genauen Sender nennt, gibt es nicht (das ist fast
// ueberall kostenpflichtige Lizenzware). Stattdessen hier eine kleine,
// manuell gepflegte Zuordnung der bekannten Rechteinhaber in Deutschland
// pro Wettbewerb. Bei Ligen mit Sender-Split (z.B. Bundesliga Sky/DAZN je
// nach Anstosszeit) ist das nicht spielgenau, aber ein ehrlicher Anhaltspunkt.
//
// WICHTIG: Rechteinhaber wechseln von Saison zu Saison. Stand: 2026-08.
// Bitte bei Bedarf hier von Hand aktualisieren, es gibt dafuer keine
// automatische Quelle.
const BROADCASTERS = [
  // Reihenfolge wichtig: spezifischere Eintraege (z.B. "2. Bundesliga")
  // muessen VOR allgemeineren ("Bundesliga") geprueft werden, da sonst
  // der allgemeinere Substring-Treffer zuerst zuschlagen wuerde.
  { match: "2. bundesliga", label: "Sky Deutschland" },
  { match: "dfb-pokal", label: "Sky Deutschland (alle Spiele), einzelne Spiele im Free-TV" },
  { match: "bundesliga", label: "Sky Deutschland & DAZN (je nach Anstosszeit)" },
  { match: "champions league", label: "DAZN, dienstags teils Amazon Prime Video" },
  { match: "premier league", label: "Sky Deutschland" },
  { match: "la liga", label: "DAZN" },
  { match: "primera division", label: "DAZN" },
  { match: "serie a", label: "DAZN" },
  { match: "ligue 1", label: "DAZN" },
];

export function getBroadcasterInfo(competitionName) {
  const c = (competitionName || "").toLowerCase();
  const hit = BROADCASTERS.find((b) => c.includes(b.match));
  return hit ? hit.label : null;
}
