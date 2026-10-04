import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertTriangle, Bell, Database, ShieldCheck, Users } from "lucide-react";
import { RIGHTS_META, TONE_CLASS } from "@/openverse/model";

const STATUS_OPTIONS = [
  "PUBLIC_DOMAIN",
  "CC_ALLOWED",
  "RIGHTS_GRANTED",
  "EMBED_ALLOWED",
  "EXTERNAL_ONLY",
  "UNKNOWN",
  "RESTRICTED",
] as const;

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="ln-card p-4">
      <p className="font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold text-gold">{value}</p>
      {hint && <p className="mt-0.5 text-[0.6875rem] text-ink-3">{hint}</p>}
    </div>
  );
}

export function AdminView() {
  const access = useQuery(api.ovAdmin.amIAdmin);
  const claim = useMutation(api.ovAdmin.claimAdmin);
  const review = useMutation(api.ovAdmin.reviewRights);
  const dashboard = useQuery(api.ovAdmin.dashboard, access?.admin ? {} : "skip");
  // Technique d'exploitation : registre des sources et état des moteurs.
  // Ces informations ne s'affichent plus dans l'interface utilisateur.
  const sources = useQuery(api.ovSources.list, access?.admin ? {} : "skip");
  const engines = useQuery(api.ovStudio.engineInfo, access?.admin ? {} : "skip");
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  if (!access) return <p className="text-sm text-ink-2">Vérification des droits d'accès…</p>;

  if (!access.admin) {
    return (
      <div className="ln-card p-6">
        <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
          <ShieldCheck className="size-5 text-gold" /> Administration
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Cette section liste les contenus, les sources, les licences, les erreurs et les alertes de droits.
          Elle est réservée aux comptes administrateurs.
        </p>
        {access.claimable && (
          <button
            type="button"
            onClick={() => void claim()}
            className="mt-4 h-10 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-4 text-sm font-semibold text-noir"
          >
            Revendiquer l'administration (premier compte)
          </button>
        )}
      </div>
    );
  }

  if (!dashboard) return <p className="text-sm text-ink-2">Chargement du tableau de bord…</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink">
          <ShieldCheck className="size-5 text-gold" /> Administration
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Contenus, connecteurs, licences, alertes de droits et journal d'erreurs.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Contenus indexés" value={dashboard.totals.contents} />
        <Stat label="Lisibles dans l'app" value={dashboard.totals.playable} hint="stream ou hébergement autorisé" />
        <Stat label="Bloqués / inconnus" value={dashboard.totals.blocked} hint="UNKNOWN ou RESTRICTED" />
        <Stat label="Connecteurs actifs" value={`${dashboard.totals.activeSources}/${dashboard.totals.sources}`} />
        <Stat label="Transcriptions" value={dashboard.totals.transcriptions} />
        <Stat label="Traductions terminées" value={dashboard.totals.translations} />
        <Stat label="Favoris" value={dashboard.totals.favorites} />
        <Stat label="Utilisateurs" value={dashboard.totals.users} />
      </div>

      <section className="ln-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Bell className="size-4 text-gold" /> Alertes de droits ({dashboard.alerts.length})
        </h2>
        {dashboard.alerts.length === 0 ? (
          <p className="mt-2 text-xs text-ink-3">Aucune alerte : tout contenu bloqué est déjà revu.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {dashboard.alerts.slice(0, 12).map((alert) => (
              <li key={alert._id} className="flex items-start gap-2 text-[0.6875rem] text-amber-200">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {alert.message}
                  {alert.meta ? <span className="text-ink-3"> — {alert.meta}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ln-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Database className="size-4 text-gold" /> Sources &amp; moteurs
        </h2>
        <p className="mt-1 text-[0.6875rem] text-ink-3">
          Un connecteur en mode « registre » est décrit mais pas encore branché : il ne renvoie aucun résultat.
        </p>
        <ul className="mt-3 divide-y divide-white/5">
          {(sources?.connectors ?? []).map((c) => (
            <li key={c.key} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-ink">
                  {c.name}{" "}
                  <span className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">{c.kind}</span>
                </p>
                <p className="text-[0.6875rem] leading-relaxed text-ink-3">{c.notes}</p>
                {c.requiresEnv.length > 0 && (
                  <p className="mt-0.5 font-mono text-[0.625rem] text-ink-3">
                    clés : {c.requiresEnv.join(", ")}
                    {c.missingEnv.length > 0 ? ` — manquantes : ${c.missingEnv.join(", ")}` : ""}
                  </p>
                )}
              </div>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[0.625rem] ${
                    c.ready ? TONE_CLASS.ok : c.implemented ? TONE_CLASS.warn : TONE_CLASS.info
                  }`}
                >
                  {c.mode}
                </span>
                <span className="font-mono text-[0.5625rem] tracking-widest text-ink-3 uppercase">
                  {c.searchEnabled ? "recherche" : c.discoverEnabled ? "rayons" : "sans requête"}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <ul className="mt-4 space-y-1.5 border-t border-white/5 pt-3 text-xs text-ink-2">
          <li>· Transcription locale : {engines?.localWhisper ? "configurée ✓" : "non configurée"}</li>
          <li>· Transcription hébergée (repli) : {engines?.groqWhisper ? "configurée ✓" : "non configurée"}</li>
          <li>· Traduction locale : {engines?.localTranslate ? "configurée ✓" : "non configurée"}</li>
          <li>· Traduction en ligne (gratuite, sans clé) : disponible ✓</li>
        </ul>
      </section>

      <section className="ln-card p-5">
        <h2 className="text-sm font-semibold text-ink">Contenus à statut incertain — revue manuelle</h2>
        <p className="mt-1 text-[0.6875rem] text-ink-3">
          Tant qu'un humain n'a pas vérifié la licence, le contenu n'est ni hébergé ni diffusé. Une revue
          administrateur verrouille la décision : les connecteurs ne l'écraseront plus.
        </p>
        {dashboard.blockedContents.length === 0 ? (
          <p className="mt-3 text-xs text-ink-3">Rien à revoir.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {dashboard.blockedContents.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className={`rounded-full border px-2 py-0.5 text-[0.625rem] ${TONE_CLASS.danger}`}>
                  {item.rightsStatus}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-sm text-ink">{item.title}</span>
                  <span className="font-mono text-[0.625rem] text-ink-3">
                    {item.source.replace("_", " ")} · {item.kind}
                    {item.reviewed ? " · revu" : ""}
                  </span>
                </span>
                <select
                  value={draft[item.key] ?? "RIGHTS_GRANTED"}
                  onChange={(e) => setDraft({ ...draft, [item.key]: e.target.value })}
                  className="h-8 rounded-lg border border-white/10 bg-noir px-2 text-[0.6875rem] text-ink"
                  aria-label={`Nouveau statut pour ${item.title}`}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {RIGHTS_META[s].dot} {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    const status = (draft[item.key] ?? "RIGHTS_GRANTED") as (typeof STATUS_OPTIONS)[number];
                    const streaming = status === "PUBLIC_DOMAIN" || status === "CC_ALLOWED" || status === "RIGHTS_GRANTED";
                    await review({
                      contentKey: item.key,
                      rightsStatus: status,
                      commercialUseAllowed: streaming,
                      fullStreamAllowed: streaming,
                      downloadAllowed: status === "PUBLIC_DOMAIN" || status === "CC_ALLOWED",
                      hostingAllowed: streaming,
                      translationAllowed: streaming || status !== "RESTRICTED",
                      derivativeWorkAllowed: streaming || status !== "RESTRICTED",
                      note: `Revue manuelle → ${status}`,
                    });
                    setNote(`Statut « ${status} » appliqué à « ${item.title} ».`);
                  }}
                  className="h-8 rounded-lg bg-gold/15 px-3 text-[0.6875rem] font-semibold text-gold"
                >
                  Appliquer
                </button>
              </li>
            ))}
          </ul>
        )}
        {note && <p className="mt-3 text-[0.6875rem] text-emerald-300">{note}</p>}
      </section>

      <section className="ln-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Database className="size-4 text-gold" /> Connecteurs
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[0.6875rem]">
            <thead className="font-mono uppercase tracking-widest text-ink-3">
              <tr>
                <th className="py-1.5 pr-3">Source</th>
                <th className="py-1.5 pr-3">Type</th>
                <th className="py-1.5 pr-3">Redistribution</th>
                <th className="py-1.5 pr-3">État</th>
                <th className="py-1.5">Dernière erreur</th>
              </tr>
            </thead>
            <tbody className="text-ink-2">
              {dashboard.sources.map((s) => (
                <tr key={s._id} className="border-t border-white/5">
                  <td className="py-1.5 pr-3 text-ink">{s.name}</td>
                  <td className="py-1.5 pr-3">{s.kind}</td>
                  <td className="py-1.5 pr-3">{s.streamingAllowed ? "oui" : "non"}</td>
                  <td className="py-1.5 pr-3">
                    <span className={`rounded-full border px-2 py-0.5 ${s.active ? TONE_CLASS.ok : TONE_CLASS.info}`}>
                      {s.active ? "actif" : "inactif"}
                    </span>
                  </td>
                  <td className="py-1.5 text-ink-3">{s.lastError ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ln-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Users className="size-4 text-gold" /> Journal récent
        </h2>
        <ul className="mt-3 space-y-1">
          {dashboard.recentLogs.slice(0, 20).map((log) => (
            <li key={log._id} className="flex gap-2 text-[0.6875rem]">
              <span
                className={
                  log.level === "error" ? "text-red-300" : log.level === "warn" ? "text-amber-300" : "text-ink-3"
                }
              >
                [{log.level}]
              </span>
              <span className="font-mono text-ink-3">{log.scope}</span>
              <span className="min-w-0 flex-1 text-ink-2">{log.message}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
