import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════
   BADGE « BIENTÔT » — une seule apparence pour une seule vérité.

   Posé UNIQUEMENT quand la langue existe mais n'a pas encore d'expressions :
   la carte, le drapeau et le focus fonctionnent, les expressions arrivent.
   Le libellé vient d'i18n (`soon.badge`) comme tout le reste de l'app, et
   le titre du badge porte l'explication complète — un utilisateur qui se
   demande pourquoi n'a pas besoin de deviner.
   ═══════════════════════════════════════════════════════════════════════ */

export function SoonBadge({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      title={t("soon.title")}
      className={cn(
        // Discret par construction : plus petit que le libellé voisin, jamais
        // en or (l'or est réservé à ce qui est actif), et il ne prend pas la
        // place du nom qu'il commente.
        "shrink-0 rounded-full border border-white/10 bg-white/5 font-mono text-[0.5625rem] tracking-wider text-ink-3 uppercase",
        "px-1.5 py-0.5",
        className,
      )}
    >
      {t("soon.badge")}
    </span>
  );
}
