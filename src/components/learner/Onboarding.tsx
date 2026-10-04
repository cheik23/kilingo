import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LANGUAGES, type LanguageCode } from "@/convex/languages";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Check, ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { MascotStage, useMascotSafe } from "@/components/three/MascotProvider";

const INTERESTS = [
  "Séries & films",
  "Hip-hop & rap",
  "Mode & streetwear",
  "Voyages",
  "Gaming",
  "Food",
  "Sport",
  "Business",
];

export function Onboarding() {
  const setFocus = useMutation(api.learning.setFocus);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<LanguageCode[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Jabari accueille : trois bulles, une par moment clé de l'accueil.
  const mascot = useMascotSafe();
  useEffect(() => {
    if (!mascot) return;
    mascot.play("wave", 2800);
    const hello = setTimeout(() => mascot.say("mascot.greet1"), 900);
    return () => clearTimeout(hello);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!mascot) return;
    if (step === 1) mascot.say("mascot.greet2");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const toggleLang = (code: LanguageCode) => {
    setSelected((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length >= 2
          ? [prev[1], code]
          : [...prev, code],
    );
  };

  const toggleInterest = (name: string) => {
    setInterests((prev) =>
      prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name],
    );
  };

  const finish = async () => {
    if (selected.length === 0) {
      toast.error("Choisis au moins une langue de focus");
      return;
    }
    setSaving(true);
    try {
      await setFocus({ languages: selected });
      mascot?.play("celebrate", 3000);
      mascot?.say("mascot.greet3");
      toast.success("Bienvenue dans l'ombre 🖤", {
        description: `${selected.map((c) => LANGUAGES.find((l) => l.code === c)?.name).join(" + ")} en focus actif`,
      });
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 px-5 py-10">
      <MascotStage
        variant="auto"
        className="h-40 w-40 sm:h-48 sm:w-48"
        bubbleClassName="justify-center"
      />
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        {step === 0 && (
          <div>
            <p className="font-mono text-xs tracking-widest text-gold uppercase">
              Étape 1 / 2
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold">
              Choisis ton focus
            </h2>
            <p className="mt-2 text-sm text-ink-2">
              2 langues maximum en focus actif — les autres resteront en
              maintenance passive.
            </p>
            <div className="mt-7 space-y-2.5">
              {LANGUAGES.map((l) => {
                const isActive = selected.includes(l.code);
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => toggleLang(l.code)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                      isActive
                        ? "border-gold/50 bg-gold/10"
                        : "border-white/8 bg-noir-2/60 hover:border-white/20"
                    }`}
                  >
                    <span className="text-2xl">{l.flag}</span>
                    <div className="flex-1">
                      <p className="font-medium">{l.name}</p>
                      <p className="text-xs text-ink-3">{l.description}</p>
                    </div>
                    {isActive && (
                      <span className="flex size-6 items-center justify-center rounded-full bg-gold text-noir">
                        <Check className="size-4" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => setStep(1)}
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft py-3.5 font-semibold text-noir transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuer <ChevronRight className="size-4" />
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="font-mono text-xs tracking-widest text-gold uppercase">
              Étape 2 / 2
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold">
              Ton lifestyle
            </h2>
            <p className="mt-2 text-sm text-ink-2">
              Personnalise le contenu : l'argot que tu verras sera lié à ce que
              tu aimes.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {INTERESTS.map((name) => {
                const on = interests.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleInterest(name)}
                    className={`rounded-full border px-4 py-2 text-sm transition-all ${
                      on
                        ? "border-gold/50 bg-gold/10 text-gold"
                        : "border-white/10 bg-noir-2/60 text-ink-2 hover:border-white/25"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={finish}
              className="ln-glow mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft py-3.5 font-semibold text-noir transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Sparkles className="size-4" />
              {saving ? "Préparation…" : "Lancer mon premier jour"}
            </button>
            <button
              type="button"
              onClick={() => setStep(0)}
              className="mt-3 w-full py-2 text-sm text-ink-3 hover:text-ink-2"
            >
              ← Retour
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
