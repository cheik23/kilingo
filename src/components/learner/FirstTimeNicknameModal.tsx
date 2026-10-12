import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Edit3, ArrowRight, AlertCircle, LogOut } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════
   MOD 4 — MODALE PSEUDO BLOQUANTE

   Affichée par AppShell tant que `user.displayName` est vide. Elle n'est pas
   une suggestion : la navigation reste inerte jusqu'à validation d'un pseudo
   (3–20 caractères). Seule échappatoire volontaire : la déconnexion.

   Textes volontairement en dur pour l'instant (pas de dépendance à i18n) :
   une passe de traduction multilingue viendra plus tard.
   ═══════════════════════════════════════════════════════════════════════ */
const CHARS_MIN = 3;
const CHARS_MAX = 20;

const COPY = {
  eyebrow: "ET TOI ?",
  title: "Comment tu veux qu'on te nomme ici ?",
  subtitle:
    "Ce pseudo apparaît dans ton profil, ton classement et tes succès. Tu pourras le changer plus tard.",
  placeholder: "ex: Baba Street",
  cta: "Valider mon pseudo",
  clear: "Effacer",
  finePrint: "Entre 3 et 20 caractères. Ce pseudo est public dans l'app.",
  charCount: `${CHARS_MIN}-${CHARS_MAX} caractères requis`,
  generic: "Impossible de sauvegarder le pseudo",
  signOut: "Se déconnecter",
} as const;

export function FirstTimeNicknameModal({ open }: { open: boolean }) {
  const updateNickname = useMutation(api.users.updateDisplayName);
  const { signOut } = useAuth();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const trimmed = value.trim();
  const tooShort = trimmed.length < CHARS_MIN;
  const disabled = saving || tooShort || trimmed.length > CHARS_MAX;

  const handleSubmit = async () => {
    if (saving) return;
    if (tooShort || trimmed.length > CHARS_MAX) {
      setLocalError(COPY.charCount);
      return;
    }
    setLocalError(null);
    setSaving(true);
    try {
      await updateNickname({ displayName: trimmed });
      // Le doc user est réactif : displayName se remplit et AppShell ferme la
      // modale toute seule. On ne touche pas à l'état local pour éviter un
      // flash de fermeture avant le retour de la query.
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setLocalError(
        message.includes("display_name_invalid") ? COPY.charCount : COPY.generic,
      );
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => {
            // Modale bloquante : le clic sur le fond ne la ferme pas.
            if (e.target === e.currentTarget) e.stopPropagation();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="nickname-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-gold/30 bg-noir-2 p-6 shadow-[0_0_60px_rgba(212,165,116,0.18)]"
          >
            <div className="absolute -top-10 right-4 -z-10 text-gold opacity-30">
              <Edit3 className="size-10" />
            </div>

            <div className="relative z-10 space-y-5 text-center">
              <div>
                <p className="flex items-center justify-center gap-2 rounded-full border border-gold/20 bg-gold/8 py-2 text-gold">
                  <Sparkles className="size-3.5" aria-hidden />
                  <span className="font-mono text-[0.625rem] tracking-[0.2em] uppercase">
                    {COPY.eyebrow}
                  </span>
                </p>
                <h2
                  id="nickname-title"
                  className="mt-4 font-display text-2xl font-semibold text-ink"
                >
                  {COPY.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  {COPY.subtitle}
                </p>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (localError) setLocalError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  placeholder={COPY.placeholder}
                  maxLength={CHARS_MAX + 4}
                  className={cn(
                    "w-full rounded-xl border bg-transparent px-3 py-2 text-center text-sm text-ink outline-none transition-colors",
                    localError
                      ? "border-[#F28B82] focus:border-[#F28B82]"
                      : "border-white/10 focus:border-gold/60",
                    "placeholder:text-ink-3",
                  )}
                  aria-invalid={!!localError}
                  aria-describedby={localError ? "nickname-error" : undefined}
                  autoFocus
                />
                {localError && (
                  <p
                    id="nickname-error"
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-[#F28B82]/10 px-3 py-2 text-xs text-[#F28B82]"
                  >
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                    {localError}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void handleSubmit()}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-6 py-3 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5 hover:opacity-90",
                    disabled ? "cursor-not-allowed opacity-40" : "",
                  )}
                >
                  {COPY.cta}
                  <ArrowRight className="size-4" aria-hidden />
                </button>

                {value && !disabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setValue("");
                      setLocalError(null);
                    }}
                    className="text-xs text-ink-3 underline-offset-2 transition-colors hover:text-ink hover:underline"
                  >
                    {COPY.clear}
                  </button>
                )}

                <p className="text-[0.6875rem] leading-relaxed text-ink-3">
                  {COPY.finePrint}
                </p>
              </div>

              <div className="border-t border-white/5 pt-4">
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="inline-flex items-center gap-1.5 text-[0.6875rem] text-ink-3 transition-colors hover:text-ink"
                >
                  <LogOut className="size-3" aria-hidden />
                  {COPY.signOut}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
