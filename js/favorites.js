import {
  db,
  doc,
  getDoc,
  setDoc,
  arrayUnion,
  messagingSupportedPromise,
  getMessagingInstance,
  getToken,
} from "./firebase-init.js";
import { vapidKey } from "./firebase-config.js";

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

// Fragt Benachrichtigungs-Berechtigung an, holt ein FCM-Geraete-Token und
// speichert es in Firestore (mehrere Geraete pro Nutzer moeglich, daher
// arrayUnion statt Ueberschreiben). Der Server-Job send_reminders.py nutzt
// diese Tokens, um ca. 60 Minuten vor Anstoss eines Favoriten eine
// Push-Benachrichtigung zu schicken.
export async function enableMatchReminders(uid, swRegistration) {
  const supported = await messagingSupportedPromise;
  if (!supported) {
    throw new Error("Push-Benachrichtigungen werden von diesem Browser/Geraet nicht unterstuetzt.");
  }
  if (!swRegistration) {
    throw new Error("Service Worker ist noch nicht bereit, bitte kurz warten und erneut versuchen.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Berechtigung fuer Benachrichtigungen wurde nicht erteilt.");
  }

  const messaging = getMessagingInstance();
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swRegistration,
  });
  if (!token) {
    throw new Error("Kein Geraete-Token erhalten.");
  }

  const ref = doc(db, "users", uid);
  await setDoc(ref, { fcmTokens: arrayUnion(token) }, { merge: true });
  return token;
}
