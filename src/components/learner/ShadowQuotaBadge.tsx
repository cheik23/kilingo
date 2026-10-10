import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { Infinity as InfinityIcon, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useI18n } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════════
   QUOTA SHADOW — MODULE B, L'AFFICHAGE

   Le quota ne doit JAMAIS surprendre. Cet encart est donc monté dans la
   surface d'analyse, visible AVANT la première analyse de la journée, et
   il recompte tout seul au changement de minute locale : à 00:00 chez
   l'utilisateur, l'affichage passe à « 5 restantes » sans rechargement.

   Trois règles de ton, vérifiées par `verify-premium-locks.mjs` :

     · on n'affiche JAMAIS « 0 restant » comme une punition. Un compteur
       à zéro est un fait (« il en reste 0 aujourd'hui »), et le passage
       à Premium est présenté comme le moyen de ne PLUS avoir de
       compteur, pas comme un moyen de ne rien perdre ;

     · l'heure de remise à zéro est la VRAIE heure locale, calculée par
       le serveur (`nextLocalMidnight`) à partir du fuseau du compte. Ce
       n'est pas un compte à rebours qui tourne : c'est un horaire, et il
       ne se réinitialise pas à l'écran — un compteur qui se réinitialise
       tout seul est un compteur dans lequel on ne peut pas avoir confiance ;

     · le fuseau de l'utilisateur est déclaré par le navigateur, une fois par
       session, et VALIDÉ côté serveur. S'il est inconnu, on affiche « UTC »
       plutôt que de mentir sur le fuseau retenu.
   ═══════════════════════════════════════════════════════════════════════ */

function formatResetTime(ms: number, lang: string): string {
  try {
    return new Date(ms).toLocaleTimeString(lang === "en" ? "en-GB" : "fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "00:00";
  }
}

export function ShadowQuotaBadge({ className = "" }: { className?: string }) {
  const { t, lang } = useI18n();
  const quota = useQuery(api.premium.getShadowQuota);
  const registerTimezone = useMutation(api.premium.registerTimezone);

  // Le fuseau est une information ENVIRONNEMENTALE, pas une préférence :
  // il sert à calculer le jour de remise à zéro. On l'envoie une fois au
  // montage, sans jamais l'écrire dans un cookie ni le demander.
  useEffect(() => {
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      tz = undefined;
    }
    if (!tz) return;
    void registerTimezone({ timezone: tz }).catch(() => undefined);
  }, [registerTimezone]);

  // Recalcul d'affichage au changement de minute locale : le compteur du
  // serveur ne bouge qu'au reset, mais l'heure affichée doit, elle, être
  // juste même si l'onglet est resté ouvert.
  useEffect(() => {
    if (!quota || quota.unlimited) return;
    const tick = () => window.dispatchEvent(new Event("focus"));
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [quota]);

  if (quota === undefined) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-ink-3 ${className}`}>
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      </span>
    );
  }

  if (quota.unlimited) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-gold ${className}`}
      >
        <InfinityIcon className="size-3.5" aria-hidden="true" />
        {t("premium.quota.unlimited")}
      </span>
    );
  }

  // Un compteur à zéro est un FAIT, pas une punition : à 0 il reste
  // « 0 analyse aujourd'hui », jamais « dernière analyse » — annoncer une
  // dernière analyse quand il n'en reste aucune serait un mensonge, et
  // c'est exactement l'état où l'utilisateur décide de passer à Premium.
  const label =
    quota.remaining === 1
      ? t("premium.quota.lastOne")
      : t("premium.quota.remaining", { n: quota.remaining });

  // Part d'essais encore disponible. Ce n'est PAS un compte à rebours : la
  // largeur suit le compteur du serveur, elle ne se décompte pas toute seule
  // entre deux requêtes. Sur une formule illimitée il n'y a rien à mesurer,
  // et le cas est déjà traité plus haut.
  const share =
    Number.isFinite(quota.limit) && quota.limit > 0
      ? Math.max(0, Math.min(100, (quota.remaining / quota.limit) * 100))
      : null;

  return (
    <span className={`inline-flex flex-col gap-1.5 ${className}`}>
      <span
        className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs ${
          quota.remaining <= 1 ? "text-gold" : "text-ink-3"
        }`}
      >
        <span>{label}</span>
        <span aria-hidden="true">·</span>
        <span>{t("premium.quota.resets", { time: formatResetTime(quota.resetsAt, lang) })}</span>
      </span>
      {share === null ? null : (
        // Barre décorative : le texte au-dessus porte déjà l'information,
        // elle est donc invisible aux lecteurs d'écran pour ne rien répéter.
        <span
          aria-hidden="true"
          className="block h-[3px] w-full max-w-56 overflow-hidden rounded-full bg-white/10"
        >
          <span
            className={`block h-full rounded-full transition-[width] duration-500 ${
              quota.remaining <= 1 ? "bg-gold" : "bg-gold/60"
            }`}
            style={{ width: `${share}%` }}
          />
        </span>
      )}
    </span>
  );
}
