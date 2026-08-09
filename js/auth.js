import {
  auth,
  googleProvider,
  signInWithRedirect,
  getRedirectResult,
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
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      authError.textContent = `Fehler beim Weiterleiten zu Google: ${err.code || ""} ${err.message}`;
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
  // Faengt Fehler aus dem Google-Redirect ab (z.B. falsch konfigurierte Domain)
  // und zeigt sie sichtbar an, statt sie nur in der Browser-Konsole zu loggen.
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        console.log("Google-Anmeldung erfolgreich:", result.user.email);
      }
    })
    .catch((err) => {
      console.error("Google-Anmeldung fehlgeschlagen:", err);
      authError.textContent = `Google-Anmeldung fehlgeschlagen: ${err.code || ""} ${err.message}`;
    });
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
