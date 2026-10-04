import { useEffect } from "react";
import { useOnline } from "@/hooks/useOnline";
import { useI18n } from "@/lib/i18n";

/**
 * RUNTIME PWA — enregistrement du service worker + bannière hors ligne.
 *
 * L'enregistrement n'a lieu qu'en PRODUCTION. En dev, un SW mettrait en cache
 * les modules Vite, amputés de leurs timestamps : chaque rechargement
 * servirait du code périmé, et on ne pourrait plus rien tester. C'est un
 * motif suffisant pour ne jamais enregistrer en dev, même si le fichier
 * existe dans `public/`.
 */
function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!("serviceWorker" in navigator)) return;

    // `register` doit être protégé en cas d'échec : une erreur réseau au premier
    // chargement est normale, et un rejet non géré ferait remonter une
    // erreur en console sur une page qui fonctionne par ailleurs.
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.error("Service worker : enregistrement impossible", error);
      }
    };

    // `load` : on ne concurrence pas le premier rendu, qui est déjà le
    // moment le plus sensible de l'app.
    if (document.readyState === "complete") void register();
    else {
      window.addEventListener("load", () => void register(), { once: true });
    }
  }, []);

  return null;
}

/**
 * Bannière « hors ligne ». Discrète, en haut, non bloquante : l'app reste
 * navigable en lecture (cartes, stats, succès déjà en cache) — seuls les
 * écrans qui appellent Convex doivent le signaler.
 */
export function OfflineBanner() {
  const { isOnline } = useOnline();
  const { t } = useI18n();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-terracotta-fill px-4 py-2 text-center text-[0.8125rem] font-medium text-noir shadow-lg"
    >
      <span aria-hidden>📡</span>
      {t("pwa.offline.banner")}
    </div>
  );
}

/** À monter une fois, à la racine de l'app. */
export function PwaRuntime() {
  return (
    <>
      <ServiceWorkerRegistrar />
      <OfflineBanner />
    </>
  );
}
