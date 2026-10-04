import { useCallback, useEffect, useState } from "react";

/**
 * Invite d'installation PWA.
 *
 * Chrome/Edge émettent `beforeinstallprompt` une seule fois, très tôt dans la
 * vie de l'onglet. Il faut donc l'écouter au montage, le stocker, et le
 * rejouer plus tard depuis les Réglages — l'événement ne se rejoue pas tout
 * seul, et Safari/iOS ne l'émet jamais (l'utilisateur passe par
 * Partager → Sur l'écran d'accueil, d'où le repli `isIos`).
 */

const DISMISS_KEY = "ln.install.dismissed";

/** Chrome expose ce champ ; sa présence est notre signal d'installabilité. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari n'expose pas display-mode sur les old versions.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed());
    setInstalled(isStandalone());

    const onBeforeInstall = (event: Event) => {
      // Empêche la mini-infobar Chrome : on veut notre propre bouton.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /**
   * Provoque l'invite native. Renvoie `false` si l'utilisateur a refusé ou
   * si le navigateur ne sait pas installer — l'appelant affiche alors les
   * instructions manuelles.
   */
  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // L'événement ne peut servir qu'une fois : on le consomme dans tous les
    // cas, sinon le bouton resterait actif mais sans effet.
    setDeferredPrompt(null);
    if (outcome === "dismissed") {
      dismiss();
    }
    return outcome === "accepted";
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const reset = useCallback(() => {
    setDismissed(false);
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    /** Chrome a proposé l'installation et l'invite n'a pas été consommée. */
    canInstall: deferredPrompt !== null && !installed,
    /** iOS : pas d'évènement, mais l'utilisateur peut le faire à la main. */
    needsManualInstall: detectIos() && !installed,
    installed,
    dismissed,
    install,
    dismiss,
    reset,
  };
}
