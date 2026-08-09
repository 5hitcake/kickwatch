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
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Nur Speicher-Cache statt IndexedDB-Persistenz: umgeht einen bekannten
// internen Firestore-SDK-Fehler ("INTERNAL ASSERTION FAILED: Pending
// promise was never set"), der durch IndexedDB-Offline-Speicherung
// ausgeloest werden kann.
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });
export const googleProvider = new GoogleAuthProvider();

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
};
