import { MascotSprite } from "@/components/three/MascotSprite";
import { useOnline } from "@/hooks/useOnline";
import { useI18n } from "@/lib/i18n";

/**
 * État « hors ligne » pour les écrans qui dépendent de Convex.
 *
 * Le piège à éviter : hors ligne, une query Convex renvoie `undefined`, ce
 * qui est indiscernable d'un « tu n'as encore rien ». L'écran affiche donc
 * « aucun résultat » alors qu'on ne sait tout simplement pas. Ce composant
 * distingue les deux cas et le dit franchement.
 *
 * Le bouton « Réessayer » est désactivé tant que le réseau est absent —
 * recharger une query qui partira en timeout n'aide personne.
 */
export function OfflineState({ className = "" }: { className?: string }) {
  const { isOnline } = useOnline();
  const { t } = useI18n();

  if (isOnline) return null;

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-noir/40 px-6 py-12 text-center ${className}`}
      role="status"
    >
      <MascotSprite state="think" className="size-20" />
      <div>
        <p className="font-display text-lg font-semibold text-ink">{t("pwa.offline.message")}</p>
        <p className="mt-1 text-xs text-ink-3">{t("pwa.offline.banner")}</p>
      </div>
      <button
        type="button"
        disabled
        title={t("pwa.offline.tooltip")}
        className="cursor-not-allowed rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-ink-3 opacity-50"
      >
        {t("pwa.offline.retry")}
      </button>
    </div>
  );
}
