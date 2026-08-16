import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore,
  memoryLocalCache,
  doc,
  getDoc,
  setDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getMessaging,
  isSupported as isMessagingSupported,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Nur Speicher-Cache statt IndexedDB-Persistenz: umgeht einen bekannten
// internen Firestore-SDK-Fehler ("INTERNAL ASSERTION FAILED: Pending
// promise was never set"), der durch IndexedDB-Offline-Speicherung
// ausgeloest werden kann.
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });
export const googleProvider = new GoogleAuthProvider();

// Messaging ist nicht ueberall verfuegbar (z.B. Safari < 16, iOS ohne
// "Zum Home-Bildschirm hinzufuegen"). isMessagingSupported() prueft das,
// bevor irgendwo getMessaging() aufgerufen wird.
export const messagingSupportedPromise = isMessagingSupported();
export function getMessagingInstance() {
  return getMessaging(app);
}

export {
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  setDoc,
  arrayUnion,
  getToken,
  onMessage,
};
