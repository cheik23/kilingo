import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";
import { useI18n } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════════
   RUNTIME PWA — enregistrement du SW + mises à jour sûres + bannière hors
   ligne.

   Trois responsabilités, une seule règle de sécurité : RIEN ne remplace le
   bundle pendant qu'un onglet l'exécute encore.

   1. ENREGISTREMENT — en PRODUCTION uniquement. En dev, un SW mettrait en
      cache les modules Vite amputés de leurs timestamps : chaque
      rechargement servirait du code périmé.

   2. MISE À JOUR (cf. public/sw.js) — le SW remplaçant reste en attente,
      l'ancien continue de servir un cache cohérent. Ici on :
        · détecte le SW en attente (`updatefound` + `registration.waiting`,
          y compris celui déjà présent au montage d'un onglet longue durée) ;
        · affiche un bandeau discret « nouvelle version » ;
        · n'active le nouveau SW (SKIP_WAITING) que sur clic EXPLICITE ;
        · recharge la page une seule fois sur `controllerchange`.
      Aucun rechargement automatique en pleine session d'apprentissage.
      Un onglet ignoré reste sur l'ancienne version — c'est voulu : il ne
      bloque jamais la nouvelle (le SW en attente attend, sans empêcher le
      déploiement suivant ni le fonctionnement de l'app).

   3. HORS LIGNE — bandeau non bloquant (lecture seule possible).
   ═══════════════════════════════════════════════════════════════════════ */

type UpdateState = {
  /** Le SW remplaçant est installé et attend la main de l'utilisateur. */
  waiting: ServiceWorker | null;
  /** Clic sur « Mettre à jour » déjà effectué : on attend `controllerchange`. */
  applying: boolean;
};

function ServiceWorkerRegistrar() {
  const { t } = useI18n();
  const [update, setUpdate] = useState<UpdateState>({ waiting: null, applying: false });
  // Garde 1 — la mise à jour a été DEMANDÉE par l'utilisateur (clic).
  // Seul ce drapeau autorise un rechargement sur `controllerchange` :
  //   · premier montage → premier `clients.claim()` → `controllerchange`
  //     SANS clic → pas de rechargement parasite à chaque visite ;
  //   · mise à jour acceptée → on recharge UNE fois (anti-boucle).
  const updateAccepted = useRef(false);
  // Garde 2 — un rechargement a déjà été déclenché pour ce cycle.
  const refreshRequested = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    // Référence stable : ajout ET retrait doivent porter sur la MÊME
    // fonction (une fonction anonyme réécrite au nettoyage ne retirerait
    // jamais l'écouteur — fuite après démontage).
    let onVisibilityChange: (() => void) | null = null;

    /** Un SW remplaçant est arrivé en attente → on propose la mise à jour. */
    const onWaiting = (worker: ServiceWorker | null) => {
      if (cancelled || !worker) return;
      // Un éventuel bandeau de mise à jour déjà en cours d'application ne
      // doit pas être écrasé (le worker en attente serait le même).
      setUpdate((prev) => (prev.applying ? prev : { waiting: worker, applying: false }));
    };

    const trackInstalling = (worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        // "installed" = SW remplaçant prêt. S'il existe déjà un contrôleur,
        // c'est une MISE À JOUR (sinon, premier install : rien à proposer).
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          onWaiting(worker);
        }
      });
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (cancelled) return;

        // Onglet resté ouvert sur un déploiement précédent : le SW en
        // attente existe DÉJÀ au montage — `updatefound` n'aura pas lieu.
        if (reg.waiting && navigator.serviceWorker.controller) onWaiting(reg.waiting);

        reg.addEventListener("updatefound", () => trackInstalling(reg.installing));

        // Un onglet longue durée ne re-vérifie pas le SW par navigation.
        // Au retour au premier plan, on relève la main : c'est le moment
        // où l'utilisateur s'attend le plus à voir une nouvelle version.
        onVisibilityChange = () => {
          if (document.visibilityState === "visible") void reg.update().catch(() => undefined);
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
      } catch (error) {
        console.error("Service worker : enregistrement impossible", error);
      }
    };

    // `controllerchange` = le nouveau SW vient de prendre le contrôle (après
    // SKIP_WAITING). C'est LE moment de recharger pour servir le nouveau
    // bundle — jamais avant, sinon un onglet servirait un index.html neuf
    // avec des chunks périmés. MAIS uniquement si l'utilisateur a accepté
    // la mise à jour : le `controllerchange` du premier `clients.claim()`
    // (visite initiale) ne déclenche AUCUN rechargement.
    const onControllerChange = () => {
      if (!updateAccepted.current) return;
      if (refreshRequested.current) return;
      refreshRequested.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    if (document.readyState === "complete") void register();
    else {
      window.addEventListener("load", () => void register(), { once: true });
    }

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (onVisibilityChange) document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  /** Activation explicite : SKIP_WAITING → `controllerchange` → rechargement.
   *  Contrat de message : CHAÎNE littérale "SKIP_WAITING", c'est ce que
   *  `sw.js` compare (`event.data === "SKIP_WAITING"`). Un objet
   *  `{ type: … }` ne matcherait jamais et l'activation ne se ferait pas. */
  const applyUpdate = useCallback(() => {
    const worker = update.waiting;
    if (!worker) return;
    updateAccepted.current = true;
    setUpdate((prev) => ({ ...prev, applying: true }));
    worker.postMessage("SKIP_WAITING");
  }, [update.waiting]);

  if (!update.waiting) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-gold px-4 py-2 text-center text-[0.8125rem] font-semibold text-noir shadow-lg"
    >
      <span aria-hidden>✨</span>
      <span>{t("pwa.update.banner")}</span>
      <button
        type="button"
        onClick={applyUpdate}
        disabled={update.applying}
        className="inline-flex items-center gap-1.5 rounded-full border border-noir/30 bg-noir/10 px-3 py-1 text-xs font-bold transition-colors hover:bg-noir/20 disabled:opacity-60"
      >
        <RefreshCw className={`size-3.5 ${update.applying ? "animate-spin" : ""}`} aria-hidden />
        {update.applying ? t("pwa.update.applying") : t("pwa.update.button")}
      </button>
    </div>
  );
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
