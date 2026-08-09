import { db, doc, getDoc, setDoc } from "./firebase-init.js";

export async function loadFavoriteTeams(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data().favoriteTeams || [];
  }
  return [];
}

export async function saveFavoriteTeams(uid, teams) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { favoriteTeams: teams }, { merge: true });
}

// Erzeugt beim ersten Aufruf einen zufaelligen, privaten Kalender-Token
// (getrennt von der Firebase-UID, damit der Link bei Bedarf ohne
// Account-Aenderung widerrufen/neu erzeugt werden kann) und speichert ihn
// in Firestore. Der taegliche Server-Abruf baut daraus data/calendar/{token}.ics
// mit genau den eigenen Favoriten.
export async function ensureCalendarToken(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data().calendarToken : null;
  if (existing) return existing;

  const token = crypto.randomUUID();
  await setDoc(ref, { calendarToken: token }, { merge: true });
  return token;
}
