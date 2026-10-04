import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/* ═══════════════════════════════════════════════════════════════════
   PONTS CULTURELS (Phase 4/4) — seed verbatim + lecture publique.

   Format source : CONCEPT|label_fr|label_en (en-tête) puis
   CONCEPT|lang|expression|gloss_fr. Upsert idempotent par slug :
   réexécuter le seed met à jour, ne duplique jamais.
   ═══════════════════════════════════════════════════════════════════ */

const RAW = `
argent|Argent|Money
fauche|Être fauché|Broke
ami|Ami / pote|Friend
probleme|Problème / galère|Trouble
fete|Fête|Party
police|Police|Police
quartier|Quartier|Hood
cool|Cool / bon|Cool
danse|Danse|Dance
genre|Genre musical|Music genre
plat|Plat de rue|Street food
amour|Amour|Love
hustle|Se démener|Hustle
salutation|Salutation|Greeting
merci|Merci|Thanks
adieu|Au revoir|Goodbye
exclamation|Exclamation|Exclamation
famille|Famille|Family
respect|Respect / honneur|Respect
dieu|Dieu / destin|God & destiny
argent|ha|naira|monnaie, argent
argent|yo|owó|fric
argent|sw|pamba|fric (argot coton)
argent|ln|mbongo|argent
argent|zu|imali|fric
argent|wo|alal|richesse, argent
argent|en|cash|fric
argent|fr|fric|argent familier
fauche|yo|sapa|être fauché
fauche|ha|sapa|fauché (pidgin)
fauche|en|broke|fauché
fauche|fr|fauché|sans argent
fauche|sw|maskini|pauvre
ami|wo|xarit|pote
ami|yo|ọrẹ́|ami
ami|ha|aboki|pote
ami|zu|mngani|pote
ami|sw|chali|gars, pote
ami|ln|ndeko|frère, pote
ami|en|cuz|cousin, pote
ami|fr|pote|ami familier
probleme|ha|wahala|galère
probleme|sw|matata|problèmes
probleme|wo|coono|malheur, galère
probleme|ln|mokakatano|problème
probleme|fr|galère|situation difficile
probleme|en|drama|embrouille
fete|yo|owambe|grande fête
fete|zu|braai|barbecue-fête
fete|sw|sherehe|fête
fete|fr|teuf|soirée
fete|en|party|fête
fete|ln|ambiance|ambiance de fête
police|yo|ọlọ́pàá|keufs
police|ha|dan sanda|flic
police|zu|maponya|police (argot SA)
police|sw|maaskari|police
police|fr|keufs|police (verlan)
police|en|ops|police (argot)
quartier|zu|kasi|quartier, hood
quartier|sw|mtaa|quartier, rue
quartier|en|block|quartier, rue
quartier|fr|cité|quartier populaire
quartier|ln|mboka|coin, pays
cool|zu|lekker|cool, bon
cool|wo|baax|bon, cool
cool|yo|dára|bon
cool|sw|poa|cool, tranquille
cool|ln|malamu|bon, bien
cool|en|cool|cool
cool|fr|chanmé|génial (verlan)
danse|yo|shaku shaku|danse shaku
danse|zu|gina|danser
danse|wo|simb|danse traditionnelle
danse|ln|ndombolo|danse ndombolo
genre|zu|amapiano|amapiano
genre|wo|mbalax|mbalax
genre|ln|rumba|rumba congolaise
genre|sw|bongo flava|bongo flava
genre|yo|afrobeats|afrobeats
plat|ha|suya|brochettes épicées
plat|yo|amala|plat d'igname
plat|zu|bunny chow|pain farci au curry
plat|sw|nyama choma|grillade
plat|ln|pondu|feuilles de manioc
plat|wo|ceeb u jën|riz au poisson (thiéboudienne)
amour|yo|ifẹ́|amour
amour|wo|mbëggeel|amour
amour|zu|uthando|amour
amour|sw|mapenzi|amour
amour|ln|bolingo|amour
amour|fr|amour|amour
hustle|yo|waka|se démener, hustler
hustle|wo|liggéey|travail, bosser
hustle|sw|kibarua|petit boulot
hustle|en|hustle|se démener
hustle|fr|taf|boulot
salutation|wo|na nga def|comment vas-tu
salutation|yo|bawo ni|comment ça va
salutation|zu|sawubona|bonjour (je te vois)
salutation|sw|mambo vipi|quoi de neuf
salutation|ha|sannu|bonjour
salutation|ln|mbote|bonjour
salutation|fr|ça va ?|salutation
salutation|en|what's up|quoi de neuf
merci|wo|jërëjëf|merci
merci|yo|e ṣe|merci
merci|zu|ngiyabonga|merci
merci|sw|asante|merci
merci|ln|matondo|merci
merci|ha|muná gódè|merci
adieu|zu|sala kahle|au revoir (reste bien)
adieu|yo|o dabọ|au revoir
adieu|sw|kwaheri|au revoir
adieu|ha|sai an jima|au revoir (à bientôt)
exclamation|zu|eish|eh ! (surprise)
exclamation|fr|wesh|eh ! / salut (verlan)
exclamation|en|yikes|ouh là
famille|wo|mbokk|famille, parent
famille|yo|ẹbí|famille
famille|zu|umndeni|famille
famille|sw|familia|famille
famille|ln|libota|famille
respect|wo|kersa|honte, pudeur (respect)
respect|yo|ìbà|respect, hommage
respect|zu|hlonipha|respecter
respect|sw|heshima|respect
dieu|yo|orí|tête, destin
dieu|wo|Yàlla|Dieu
dieu|zu|uNkulunkulu|Dieu
dieu|sw|Mungu|Dieu
dieu|ln|Nzambe|Dieu
dieu|ha|Allah|Dieu
`;

type Parsed = {
  slug: string;
  labelFr: string;
  labelEn: string;
  entries: { lang: string; expr: string; gloss: string }[];
};

/** Parse le bloc verbatim (aucune donnée inventée, ordre conservé). */
export function parseCrossData(raw: string): Parsed[] {
  const bySlug = new Map<string, Parsed>();
  for (const line of raw.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const parts = l.split("|").map((p) => p.trim());
    if (parts.length === 3) {
      // En-tête de concept : CONCEPT|label_fr|label_en
      const [slug, labelFr, labelEn] = parts;
      if (!bySlug.has(slug)) {
        bySlug.set(slug, { slug, labelFr, labelEn, entries: [] });
      }
    } else if (parts.length === 4) {
      // Entrée : CONCEPT|lang|expression|gloss_fr
      const [slug, lang, expr, gloss] = parts;
      let c = bySlug.get(slug);
      if (!c) {
        c = { slug, labelFr: slug, labelEn: slug, entries: [] };
        bySlug.set(slug, c);
      }
      if (!c.entries.some((e) => e.lang === lang && e.expr === expr)) {
        c.entries.push({ lang, expr, gloss });
      }
    }
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Tous les concepts, triés par slug (lecture publique). */
export const getCrossConcepts = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("crossConcepts").collect();
    return rows
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((r) => ({
        slug: r.slug,
        labelFr: r.labelFr,
        labelEn: r.labelEn,
        entries: r.entries,
      }));
  },
  returns: v.array(
    v.object({
      slug: v.string(),
      labelFr: v.string(),
      labelEn: v.string(),
      entries: v.array(
        v.object({ lang: v.string(), expr: v.string(), gloss: v.string() }),
      ),
    }),
  ),
});

/** Seed idempotent : upsert par slug (mutation publique). */
export const seedCrossConcepts = mutation({
  args: {},
  handler: async (ctx) => {
    const parsed = parseCrossData(RAW);
    const existing = await ctx.db.query("crossConcepts").collect();
    const bySlug = new Map(existing.map((r) => [r.slug, r]));
    let created = 0;
    let updated = 0;
    for (const p of parsed) {
      const row = bySlug.get(p.slug);
      if (!row) {
        await ctx.db.insert("crossConcepts", p);
        created += 1;
      } else if (
        row.labelFr !== p.labelFr ||
        row.labelEn !== p.labelEn ||
        JSON.stringify(row.entries) !== JSON.stringify(p.entries)
      ) {
        await ctx.db.patch(row._id, {
          labelFr: p.labelFr,
          labelEn: p.labelEn,
          entries: p.entries,
        });
        updated += 1;
      }
    }
    // Nettoyage : concepts disparus du seed (sécurité).
    const keep = new Set(parsed.map((p) => p.slug));
    for (const row of existing) {
      if (!keep.has(row.slug)) {
        await ctx.db.delete(row._id);
      }
    }
    return { concepts: parsed.length, created, updated };
  },
  returns: v.object({
    concepts: v.number(),
    created: v.number(),
    updated: v.number(),
  }),
});
