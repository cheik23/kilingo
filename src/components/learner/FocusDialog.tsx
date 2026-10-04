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

export function FocusDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const myLanguages = useQuery(api.learning.myLanguages);
  const switchFocus = useMutation(api.learning.switchFocus);
  const setFocus = useMutation(api.learning.setFocus);
  const [selected, setSelected] = useState<LanguageCode[]>([]);

  useEffect(() => {
    if (open && myLanguages) {
      setSelected(
        myLanguages.activeFocus.length > 0
          ? myLanguages.activeFocus
          : (["en", "zh"] as LanguageCode[]),
      );
    }
  }, [open, myLanguages]);

  const toggle = (code: LanguageCode) => {
    setSelected((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length >= 2
          ? [prev[1], code] // rotate: drop the oldest, keep max 2
          : [...prev, code],
    );
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
    } catch {
      toast.error("Impossible de changer le focus");
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
                <span className="text-2xl">{l.flag}</span>
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
