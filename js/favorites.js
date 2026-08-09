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
