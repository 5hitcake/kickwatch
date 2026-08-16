// Oeffentliche Client-Konfiguration (kein Geheimnis) - Sicherheit laeuft
// ueber die Firestore-Sicherheitsregeln, nicht ueber Geheimhaltung dieser Werte.
export const firebaseConfig = {
  apiKey: "AIzaSyCo3y-FyFMJ0UhzYXfjFmPDWoLpPgGUzrE",
  authDomain: "kickwatxh.firebaseapp.com",
  projectId: "kickwatxh",
  storageBucket: "kickwatxh.firebasestorage.app",
  messagingSenderId: "254019688686",
  appId: "1:254019688686:web:b84e3e9800d6a792857bff",
};

// Oeffentlicher VAPID-Schluessel fuer Web Push (Firebase Cloud Messaging) -
// aus der Firebase-Konsole unter Projekteinstellungen > Cloud Messaging >
// Web-Push-Zertifikate. Auch dieser Wert ist oeffentlich (kein Geheimnis).
export const vapidKey = "REPLACE_ME_VAPID_KEY";
