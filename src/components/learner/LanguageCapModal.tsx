import { Link } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Lock, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════════
   MODALE CAP DE LANGUES — boutique premium

   Triggerée depuis FocusDialog ET Onboarding quand setFocus retourne une
   erreur contenant language_cap (voir premiumLimits.ts → isLanguageCapError).
   ═══════════════════════════════════════════════════════════════════════ */
export function LanguageCapModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {

  const { t } = useI18n();
  const lockTitle = t("premium.lock.languages.title");
  const lockBody = t("premium.lock.languages.body");
  const lockCta = t("premium.lock.languages.cta");
  const upsellTitle = t("premium.upsell.title");
  const upsellFine = t("premium.upsell.finePrint");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-label={lockTitle}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gold/30 bg-noir-2 p-6 shadow-[0_0_60px_rgba(212,165,116,0.18)]"
          >
            {/* Ceramic spacer — cohérent avec le langage visuel du produit. */}
            <div className="absolute -top-10 right-4 fill-gradient-to-br from-gold-soft/40 to-transparent text-gold">
              <Lock className="size-10 opacity-40" />
            </div>

            <div className="relative z-10 space-y-5 text-center">
              <div className="flex items-center justify-center gap-2 rounded-full border border-gold/20 bg-gold/8 py-2 text-gold">
                <Sparkles className="size-3.5" aria-hidden />
                <span className="font-mono text-[0.625rem] tracking-[0.2em] uppercase">{upsellTitle}</span>
              </div>

              <p className="text-lg font-display font-semibold text-ink">{lockTitle}</p>
              <p className="text-sm leading-relaxed text-ink-2">{lockBody}</p>

              <div className="flex flex-col items-center gap-3">
                <Link
                  to="/app/store"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-6 py-3 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5 hover:opacity-90"
                >
                  {lockCta}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>

                <p className="text-[0.6875rem] leading-relaxed text-ink-3">{upsellFine}</p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-ink-2 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-ink"
              >
                {t("common.close")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
