import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LANGUAGES, type LanguageCode } from "@/convex/languages";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Flame, Moon } from "lucide-react";

import { FlagIcon } from "@/components/ui/FlagIcon";
import { useI18n } from "@/lib/i18n";
import { isLanguageCapError } from "@/lib/premiumLimits";
import { PremiumUpsell } from "./PremiumUpsell";
import { LanguageCapModal } from "./LanguageCapModal";

/* ═══════════════════════════════════════════════════════════════════
   FOCUS DE LANGUES — MODULE A

   Deux règles tenues ici, et une seule autorité (le serveur).

   1. LE PLAFOND EST ANNONCÉ AVANT. Il vient de `learning.myLanguages`
      (`activeLanguageCap`, calculé serveur) : le client l'AFFICHE, il ne
      le recalcule pas. Au-delà du plafond on n'effectue pas de
      remplacement silencieux — on explique ce que Premium ouvre.

   2. UN REFUS N'EST PAS UNE ERREUR. Si le serveur refuse encore (client
      plus ancien, état changé entre-temps), on reconnaît le code
      `language_cap` et on montre la MÊME invite que les Modules B et C,
      au lieu d'un « impossible » qui ne mène nulle part. Aucune langue
      n'est retirée : le refus est rendu sans la moindre écriture.
   ═══════════════════════════════════════════════════════════════════ */

export function FocusDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const myLanguages = useQuery(api.learning.myLanguages);
  const switchFocus = useMutation(api.learning.switchFocus);
  const setFocus = useMutation(api.learning.setFocus);
  const [selected, setSelected] = useState<LanguageCode[]>([]);
  /** Plafond atteint : on montre l'invite, pas un toast d'erreur. */
  const [capBlocked, setCapBlocked] = useState(false);

  useEffect(() => {
    if (open && myLanguages) {
      setSelected(
        myLanguages.activeFocus.length > 0
          ? myLanguages.activeFocus
          : (["en", "zh"] as LanguageCode[]),
      );
      setCapBlocked(false);
    }
  }, [open, myLanguages]);

  const toggle = (code: LanguageCode) => {
    if (selected.includes(code)) {
      setSelected(selected.filter((c) => c !== code));
      setCapBlocked(false);
      return;
    }
    // Plafond fourni par le SERVEUR. Absent (query en vol) = on n'anticipe
    // rien : c'est le serveur qui tranchera, et il reste l'autorité.
    const cap = myLanguages?.activeLanguageCap;
    if (cap === undefined || selected.length < cap) {
      setSelected([...selected, code]);
      return;
    }
    // Plafond atteint. Jusqu'à deux langues on fait tourner la sélection
    // (un abonné change de langue librement) ; à une seule langue on
    // EXPLIQUE au lieu de remplacer en silence.
    if (cap >= 2) {
      setSelected([...selected.slice(1), code]);
      return;
    }
    setCapBlocked(true);
  };

  const save = async () => {
    if (selected.length === 0) {
      toast.error("Sélectionne au moins une langue de focus");
      return;
    }
    try {
      if (myLanguages && myLanguages.rows.length > 0) {
        await switchFocus({ activate: selected });
      } else {
        await setFocus({ languages: selected });
      }
      toast.success("Focus mis à jour", {
        description: `${selected.length} langue${selected.length > 1 ? "s" : ""} en focus actif`,
      });
      onOpenChange(false);
    } catch (err) {
      // Le serveur est la seule autorité. Un refus de plafond se TRADUIT
      // (même règle que les Modules B et C) ; toute autre erreur reste
      // signalée telle quelle, jamais avalée.
      if (isLanguageCapError(err)) {
        setCapBlocked(true);
      } else {
        toast.error(
          err instanceof Error ? err.message : "Impossible de changer le focus",
        );
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-noir-2 text-ink sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Changer de focus
          </DialogTitle>
          <DialogDescription className="text-ink-2">
            Sélectionne 1 ou 2 langues pour le focus actif. Les autres
            passeront en maintenance passive (révisions seulement).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 py-2">
          {LANGUAGES.map((l) => {
            const isActive = selected.includes(l.code);
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => toggle(l.code)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
                  isActive
                    ? "border-gold/50 bg-gold/10 shadow-[0_0_0_1px_rgba(212,165,116,0.25)]"
                    : "border-white/8 bg-noir-3/60 hover:border-white/20"
                }`}
              >
                <FlagIcon languageCode={l.code} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{l.name}</p>
                  <p className="font-mono text-[0.625rem] text-ink-3">
                    {l.countries}
                  </p>
                </div>
                {isActive ? (
                  <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 font-mono text-[0.625rem] text-gold">
                    <Flame className="size-3" /> ACTIF
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 font-mono text-[0.625rem] text-ink-3">
                    <Moon className="size-3" /> PASSIF
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {capBlocked ? (
          <div className="space-y-4">
            <PremiumUpsell
              variant="card"
              title={t("premium.lock.languages.title")}
              body={t("premium.lock.languages.body")}
              cta={t("premium.lock.languages.cta")}
              // L'issue gratuite d'abord, comme partout : garder sa langue
              // actuelle ne coûte rien, et rien n'a été retiré au compte.
              freeAction={{
                label: t("common.close"),
                onClick: () => setCapBlocked(false),
              }}
              // Le CTA mène aux tarifs : on referme la boîte en partant,
              // sinon elle resterait posée par-dessus la page.
              onCtaClick={() => onOpenChange(false)}
            />
            <LanguageCapModal
              open={capBlocked}
              onClose={() => setCapBlocked(false)}
            />
          </div>
        ) : null}

        <div className="flex gap-3">
          <Button
            onClick={save}
            className="flex-1 bg-gradient-to-r from-gold to-gold-soft font-semibold text-noir hover:opacity-90"
          >
            Confirmer
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/15 bg-transparent hover:bg-white/5 hover:text-ink"
          >
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
