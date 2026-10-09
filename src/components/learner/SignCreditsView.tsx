import { Link } from "react-router";
import { ArrowLeft, ExternalLink, ScrollText } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { PlaceHeader } from "@/components/fx/PlaceHeader";

/* ═══════════════════════════════════════════════════════════════════════
   CRÉDITS ET LICENCES — LANGUE DES SIGNES (LSF)

   Cette page n'est pas une décoration : c'est l'obligation CC BY, et la
   seule façon de rendre vérifiable ce que l'application affiche. Elle
   affiche donc les CHIFFRES DU CATALOGUE, lus en base à chaque appel —
   pas un texte figé qui pourrait mentir après un réimport.

   Trois informations que la page doit pouvoir dire sans arrangement :

     · combien de clips, et sous quelles licences exactement ;
     · qui a signé chaque famille de clips ;
     · où les fichiers sont servis, et le fait que Kilingo n'en héberge
       aucun.
   ═══════════════════════════════════════════════════════════════════════ */

const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} Mo`;

export function SignCreditsView() {
  const { t } = useI18n();
  const credits = useQuery(api.signs.getCredits, {});

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PlaceHeader
        place="signs"
        title={t("signs.creditsTitle")}
        icon={ScrollText}
        motif="adinkra"
        description={t("signs.creditsIntro")}
      />

      {credits === undefined ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="ln-card p-4">
              <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                {t("signs.source")}
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-gold">{credits.total}</p>
              <p className="text-xs text-ink-3">clips LSF</p>
            </div>
            <div className="ln-card p-4">
              <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                {t("signs.creditsHosting")}
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-gold">
                {mb(credits.bytes)}
              </p>
              <p className="text-xs text-ink-3">poids des fichiers d'origine</p>
            </div>
            <div className="ln-card p-4">
              <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
                {t("signs.creditsReports")}
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-gold">
                {credits.openReports}
              </p>
              <p className="text-xs text-ink-3">sur {credits.reportedSigns} signe(s)</p>
            </div>
          </section>

          <section className="ln-card p-5">
            <h2 className="font-display text-lg text-ink">{t("signs.creditsCounts")}</h2>
            <ul className="mt-3 space-y-2">
              {credits.byLicense.map((row) => (
                <li key={row.license} className="flex items-center justify-between text-sm">
                  <a
                    href={
                      row.license === "CC0"
                        ? "https://creativecommons.org/publicdomain/zero/1.0/"
                        : "https://creativecommons.org/licenses/by/3.0/"
                    }
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 text-gold underline underline-offset-2"
                  >
                    {row.license} <ExternalLink className="size-3" />
                  </a>
                  <span className="text-ink-2">{row.count} clips</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-ink-3">
              Ni CC BY-SA, ni CC BY-NC : ces licences ont été lues dans les
              métadonnées de chaque fichier au moment de l'import, et les
              fichiers qui les portaient ont été rejetés. Le catalogue ne
              contient que du CC0 et du CC BY.
            </p>
          </section>

          <section className="ln-card p-5">
            <h2 className="font-display text-lg text-ink">{t("signs.creditsSigners")}</h2>
            <ul className="mt-3 space-y-2">
              {credits.signers
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((row) => (
                  <li
                    key={row.signer}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-ink">{row.signer}</span>
                    <span className="text-xs text-ink-3">
                      {row.count} clips · {row.license}
                    </span>
                  </li>
                ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-ink-3">
              La LSF a des variantes régionales. Ces clips montrent la LSF de
              quelques signeurs, pas « la » LSF : c'est pourquoi chaque fiche
              porte un bouton « Signaler une erreur ».
            </p>
          </section>

          <section className="ln-card p-5">
            <h2 className="font-display text-lg text-ink">{t("signs.creditsHosting")}</h2>
            <p className="mt-2 text-sm text-ink-2">{t("signs.creditsHostingLine")}</p>
            <p className="mt-2 text-sm text-ink-2">{credits.hostingNote}</p>
            <dl className="mt-4 space-y-1 text-xs text-ink-3">
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 font-mono uppercase">source</dt>
                <dd>{credits.source}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 font-mono uppercase">manifeste</dt>
                <dd>{new Date(credits.generatedAt).toISOString().slice(0, 10)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 font-mono uppercase">mode</dt>
                <dd>{credits.hosting}</dd>
              </div>
            </dl>
          </section>
        </>
      )}

      <Link
        to="/app/signs"
        className="flex items-center gap-1.5 text-sm text-ink-2 hover:text-gold"
      >
        <ArrowLeft className="size-4" /> {t("signs.title")}
      </Link>
    </div>
  );
}
