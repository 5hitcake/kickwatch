import {
  auth,
  googleProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
  signOut,
} from "./firebase-init.js";

const EMAIL_STORAGE_KEY = "kickwatch-email-for-signin";

function getRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

export function initAuthUI({ onLogin, onLogout }) {
  const googleBtn = document.getElementById("google-signin-btn");
  const emailForm = document.getElementById("email-signin-form");
  const emailInput = document.getElementById("email-signin-input");
  const emailStatus = document.getElementById("email-signin-status");
  const authError = document.getElementById("auth-error");
  const logoutBtn = document.getElementById("logout-btn");

  googleBtn.addEventListener("click", async () => {
    authError.textContent = "";
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged uebernimmt den Rest (onLogin wird automatisch ausgeloest).
    } catch (err) {
      if (err.code === "auth/popup-blocked") {
        authError.textContent =
          "Popup wurde blockiert. Bitte Popups fuer diese Seite erlauben und nochmal versuchen.";
      } else if (err.code === "auth/cancelled-popup-request" || err.code === "auth/popup-closed-by-user") {
        // Nutzer hat das Popup selbst geschlossen - kein Fehler, den man anzeigen muss.
      } else {
        authError.textContent = `Google-Anmeldung fehlgeschlagen: ${err.code || ""} ${err.message}`;
      }
    }
  });

  emailForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;

    try {
      await sendSignInLinkToEmail(auth, email, {
        url: getRedirectUrl(),
        handleCodeInApp: true,
      });
      window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
      emailStatus.textContent = `Anmeldelink an ${email} geschickt - E-Mails pruefen (auch Spam-Ordner) und Link antippen.`;
    } catch (err) {
      emailStatus.textContent = `Fehler beim Senden: ${err.message}`;
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });

  onAuthStateChanged(auth, (user) => {
    if (user) {
      onLogin(user);
    } else {
      onLogout();
    }
  });

  completeEmailLinkSignInIfNeeded(authError);
}

async function completeEmailLinkSignInIfNeeded(authError) {
  if (!isSignInWithEmailLink(auth, window.location.href)) return;

  let email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
  if (!email) {
    email = window.prompt("Zur Bestaetigung: mit welcher E-Mail-Adresse hast du dich angemeldet?");
  }
  if (!email) return;

  try {
    await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem(EMAIL_STORAGE_KEY);
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (err) {
    console.error("E-Mail-Link-Anmeldung fehlgeschlagen:", err);
    if (authError) {
      authError.textContent = `E-Mail-Link-Anmeldung fehlgeschlagen: ${err.code || ""} ${err.message}`;
    }
  }
}
