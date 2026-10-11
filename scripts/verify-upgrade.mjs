/* ═══════════════════════════════════════════════════════════════════
   CONVERSION — CONTRÔLE D'HONNÊTET (réparé pour CE dépôt)

   Le script d'origine avait été copié depuis `lingua-noir-main` et
   importait des modules qui n'ont jamais été versionnés ici
   (`src/lib/avatarKit.ts`, `src/lib/argotShowcase.ts`,
   `slang-catalog.json`, `src/components/landing/{Convert,Hero,Demo,
   Argot}.tsx`) : il mourait à l'import, avant même le premier contrôle.
   Il n'a donc jamais pu passer dans ce dépôt.

   Cette version garde chaque contrôle qui a une CIBLE RÉELLE ici, et
   laisse les deux modules dont le sujet n'existe pas dans ce dépôt en
   `skip` EXPLICITE (jamais un faux `ok`) : si l'artefact revient un
   jour, le contrôle se réactive tout seul.

   Contrôles, tous vérifiables sans navigateur :

   1. COPY UPGRADE — les 12 langues portent les 3 moments post-engagement.
   2. COPY LANDING — les 12 langues portent la page publique complète
      (badge, titre, sous-titre, 2 CTA, réassurance, preuve sociale,
      les 3 chiffres de la bande « features », légende du globe). Une
      langue manquante = un visiteur qui lit du français sous son header.
   3. PATTERNS INTERDITS — compte à rebours, fausse urgence, fausse
      rareté, case pré-cochée, vocabulaire de perte, dissimulation.
   4. MONTANTS — la copy DÉRIVE de `lib/pricing.ts` (formatEur, PREMIUM,
      premiumPerDayEur, premiumAnnualDiscountPct) et n'écrit AUCUN
      montant décimal en dur. C'est ce qui empêche un prix de diverger
      en silence de sa source unique.
   5. CAISSE — le bouton Premium est un vrai chemin de paiement, monté
      une seule fois, qui DIT « bientôt disponible » quand le serveur
      n'a pas confirmé le prestataire.
   6. ANNULATION — le portail client est appelé au clic et son URL
      signée n'est jamais stockée ; la carte est montée pour un compte
      connecté.
   7. CHIFFRES VÉRIFIABLES — les nombres de la copy sont confrontés aux
      tables du dépôt (`languages.ts`, `aiCharacters.ts`).
   8. ORDRE DU FUNNEL — dans `src/pages/Landing.tsx` : argot → langues →
      pricing, et le CTA final vient après le prix.

   Usage : `node scripts/verify-upgrade.mjs`  (Node ≥ 23 : .ts natif)
   ═══════════════════════════════════════════════════════════════════ */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  UPGRADE_LANGS,
  UPGRADE_MOMENT_KEYS,
  getUpgradeCopy,
} from "../src/lib/i18n.upgrade.ts";
import { getLandingCopy } from "../src/lib/i18n.landing.ts";
import {
  PREMIUM,
  formatEur,
  premiumPerDayEur,
  premiumAnnualDiscountPct,
} from "../src/lib/pricing.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(resolve(ROOT, rel), "utf8");
const has = (rel) => existsSync(resolve(ROOT, rel));

let failures = 0;
let skipped = 0;
const ok = (msg) => console.log(`ok    ${msg}`);
const fail = (msg) => {
  console.log(`FAIL  ${msg}`);
  failures++;
};
const skip = (msg) => {
  console.log(`skip  ${msg}`);
  skipped++;
};
/** Un contrôle par langue, une seule ligne de verdict pour ne pas noyer. */
const verdict = (missing, label) => {
  if (missing.length) fail(`${label}: ${missing.length} manque(s) → ${missing.join(", ")}`);
  else ok(label);
};

/* ── 1 · COPY UPGRADE — LES 12 LANGUES ──────────────────────────────── */

const TEXT_KEYS = ["badge", "cta", "dismiss", "note"];

for (const lang of UPGRADE_LANGS) {
  const copy = getUpgradeCopy(lang);
  if (!copy) {
    fail(`${lang}: aucune copy`);
    continue;
  }
  const up = copy.upgrade;
  const missing = TEXT_KEYS.filter((k) => !up[k]);
  for (const m of UPGRADE_MOMENT_KEYS) if (!up.moments?.[m]) missing.push(`moments.${m}`);
  if (missing.length) fail(`${lang}: ${missing.length} clé(s) manquante(s) → ${missing.join(", ")}`);
  else ok(`${lang}: ${TEXT_KEYS.length + UPGRADE_MOMENT_KEYS.length} clés complètes`);
}

if (UPGRADE_LANGS.length !== 12) fail(`12 langues attendues, ${UPGRADE_LANGS.length} trouvées`);

/* ── 2 · COPY LANDING — LES 12 LANGUES ──────────────────────────────── */

const LANDING_KEYS = [
  "badge",
  "title",
  "subtitle",
  "cta",
  "ctaSecondary",
  "reassurance",
  "learners",
  "globeCaption",
];
const FEATURE_KEYS = [
  "title",
  "lead",
  "languagesValue",
  "languagesLabel",
  "expressionsValue",
  "expressionsLabel",
  "avatarValue",
  "avatarLabel",
];

for (const lang of UPGRADE_LANGS) {
  const copy = getLandingCopy(lang);
  const landing = copy?.landing;
  if (!landing) {
    fail(`landing ${lang}: aucune copy`);
    continue;
  }
  const missing = LANDING_KEYS.filter((k) => !landing[k]);
  const features = landing.features ?? {};
  for (const k of FEATURE_KEYS) if (!features[k]) missing.push(`features.${k}`);
  if (missing.length) fail(`landing ${lang}: ${missing.length} clé(s) manquante(s) → ${missing.join(", ")}`);
  else ok(`landing ${lang}: ${LANDING_KEYS.length + FEATURE_KEYS.length} clés complètes`);
}

/* ── 3 · PATTERNS INTERDITS ─────────────────────────────────────────── */

/* Motifs globaux : matche n'importe où, insensible à la casse. */
const BANNED_GLOBAL = [
  // Fausse urgence / compte à rebours
  { re: /\b(plus que|encore)\s+\d+\s*(h|heure|heures|min|minute|minutes|secondes?|j|jours?)\b/i, why: "compte à rebours" },
  { re: /\b(expire|expirera|expiration)\s+(dans|le)\b/i, why: "date limite" },
  { re: /\b(offre|promo|deal)\s+(limitee|limité|courte|bientôt\s+finie)\b/i, why: "fausse urgence" },
  { re: /\b(last\s+chance|derni[eè]re\s+chance)\b/i, why: "fausse urgence" },
  { re: /\b(countdown|temps\s+restant)\b/i, why: "compte à rebours" },
  // Fausse rareté
  { re: /\b(plus que|restent?)\s+\d*\s*(places?|slots?|inscriptions?)\b/i, why: "fausse rareté" },
  { re: /\b(derni[eè]res?|last)\s+(places?|slots?)\b/i, why: "fausse rareté" },
  { re: /\b(places?|slots?)\s+(restantes?|disponibles?|limitées?)\b/i, why: "fausse rareté" },
  { re: /\b(il ne reste que|only\s+\d+\s+left)\b/i, why: "fausse rareté" },
  { re: /\b(stock|inventaire)\s+(limite|faible)\b/i, why: "fausse rareté" },
  // Case pré-cochée / friction cachée
  { re: /defaultChecked/, why: "case pré-cochée" },
  { re: /\b(pre-?coch[eé]|coch[eé]\s+par\s+d[ée]faut)\b/i, why: "case pré-cochée" },
  // Vocabulaire de perte sur la conversion
  { re: /\b(perds|perdez|vas?\s+perdre|vais?\s+perdre)\s+(tes\s+)?(acc[eè]s|progr[eè]s|donn[eé]es)\b/i, why: "pression par la perte" },
  { re: /\b(ne\s+rate\s+pas|rat[eé]\s+ta\s+chance)\b/i, why: "pression par la perte" },
];

/**
 * Vocabulaire de perte AUTORISÉ, parce que factuel et déjà présent dans le
 * produit hors funnel : « Plus que N pour un badge » est une progression
 * réelle vers un succès réel. La règle porte sur l'URGENCE, pas sur le
 * décompte d'un objectif.
 */
const ALLOWED_LOSS = [
  /Plus que\s+(\{?n\}?|\d+)\s+(expressions?|quiz|conversations?)/i,
  /Plus que\s+\{x\}\s+pour\s+\{title\}/,
];

/* Fichiers réellement présents dans CE dépôt : la landing est monolithique
   (`src/pages/Landing.tsx`) et n'a pas de dossier `components/landing`. */
const FILES = [
  "src/lib/i18n.upgrade.ts",
  "src/lib/i18n.landing.ts",
  "src/components/learner/UpgradeMoment.tsx",
  "src/components/learner/PremiumCta.tsx",
  "src/pages/Landing.tsx",
];

for (const file of FILES) {
  const src = read(file);
  const hits = [];
  for (const { re, why } of BANNED_GLOBAL) {
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      if (!re.test(line)) return;
      if (ALLOWED_LOSS.some((a) => a.test(line))) return;
      // Les motifs sont écrits en commentaire dans les fichiers (pour
      // documenter l'interdiction) : on ignore la ligne d'où ils viennent.
      const trimmed = line.trim();
      if (
        trimmed.startsWith("*") ||
        trimmed.startsWith("//") ||
        trimmed.startsWith("/*") ||
        trimmed.includes("{ re:") ||
        trimmed.includes("{ why:")
      ) {
        return;
      }
      hits.push(`L${i + 1} [${why}] ${trimmed.slice(0, 70)}`);
    });
  }
  if (hits.length) fail(`${file}: ${hits.length} motif(s) interdit(s)\n        ${hits.join("\n        ")}`);
  else ok(`${file}: aucun pattern interdit`);
}

/* ── 4 · MONTANTS — LA COPY DÉRIVE DE LA SOURCE UNIQUE ──────────────── */

const landingSrc = read("src/pages/Landing.tsx");
const premiumCtaSrc = read("src/components/learner/PremiumCta.tsx");
const paymentsSrc = read("src/lib/payments.ts");
const subscriptionSrc = read("src/components/learner/SubscriptionCard.tsx");

/* La copy affichée doit ÊTRE le calcul, pas une recopie du calcul : si ces
   jetons disparaissent, un « 9,99 € » écrit à la main a pris leur place. */
const DERIVED_TOKENS = [
  ["formatEur(", "le montant passe par formatEur (lib/pricing)"],
  ["PREMIUM.", "le montant vient de PREMIUM (lib/pricing)"],
  ["premiumPerDayEur()", "l'ancrage « par jour » est calculé, jamais recopié"],
  ["premiumAnnualDiscountPct()", "la remise annuelle est calculée, jamais recopiée"],
];
for (const [token, label] of DERIVED_TOKENS) {
  if (!landingSrc.includes(token)) fail(`landing: ${label} a disparu (jeton « ${token} » absent)`);
  else ok(`montants: ${label}`);
}

/* Aucun montant décimal en dur (un « 0 € » de palier gratuit reste permis). */
const PRICE_LITERAL = /\d{1,3}[.,]\d{2}\s*€/;
const withLiteral = ["src/pages/Landing.tsx", "src/components/learner/PremiumCta.tsx", "src/lib/payments.ts"].filter(
  (f) => PRICE_LITERAL.test(read(f)),
);
if (withLiteral.length) fail(`montant écrit en dur dans ${withLiteral.join(", ")} (tout doit venir de lib/pricing.ts)`);
else ok("montants: aucun montant décimal en dur (tout vient de lib/pricing.ts)");

/* Cohérence interne du barème : une annuité plus chère que 12 mois, ou une
   remise invraisemblable, rendrait l'ancrage public faux. */
const discount = premiumAnnualDiscountPct();
if (!Number.isFinite(discount) || discount <= 0 || discount >= 90) {
  fail(`remise annuelle invraisemblable : -${discount} % (${PREMIUM.annualEur} vs ${PREMIUM.monthlyEur}×12)`);
} else {
  ok(`remise annuelle : -${discount} % = calcul (${formatEur(PREMIUM.annualEur)} vs ${formatEur(PREMIUM.monthlyEur)}×12)`);
}
const perDay = premiumPerDayEur();
if (perDay !== formatEur(PREMIUM.monthlyEur / PREMIUM.anchorDays)) {
  fail(`l'ancrage par jour (${perDay}) ne correspond pas au calcul du barème`);
} else {
  ok(`ancrage : le prix par jour est calculé (${perDay}/jour sur ${PREMIUM.anchorDays} j)`);
}

/* ── 5 · LA CAISSE EST HONNÊTE ──────────────────────────────────────── */

/* Le bouton de paiement est monté UNE fois : c'est ce montage qui interroge
   l'état du prestataire. Deux boutons = deux vérités possibles. */
const ctaMounts = (landingSrc.match(/<PremiumCta\b/g) ?? []).length;
if (ctaMounts !== 1) fail(`landing: ${ctaMounts} montage(s) de PremiumCta (1 attendu)`);
else ok("caisse: le bouton Premium est monté une seule fois");

if (!/createCheckoutSession/.test(paymentsSrc)) {
  fail("lib/payments: n'appelle pas createCheckoutSession — le bouton ne paie donc rien");
} else ok("caisse: lib/payments appelle createCheckoutSession");

/* Le repli « bientôt disponible » doit être câblé des deux côtés : le
   composant l'affiche, la lib lit l'état du serveur. */
if (!/usePaymentsReady/.test(premiumCtaSrc) || !/soonMessage/.test(premiumCtaSrc)) {
  fail("PremiumCta: sans repli sur « bientôt disponible », le bouton promettrait une caisse qui échoue");
} else ok("PremiumCta: repli « bientôt disponible » quand le prestataire n'est pas prêt");

if (!/checkoutReady/.test(paymentsSrc)) {
  fail("lib/payments: l'état « le prestataire est-il prêt ? » n'est pas lu");
} else ok("lib/payments: l'état du prestataire est lu avant de promettre une caisse");

/* ── 6 · ANNULATION — LE PORTAIL, PAS UN FORMULAIRE MAISON ──────────── */

if (!/createPortalSession/.test(paymentsSrc)) {
  fail("annulation: le portail client n'est jamais appelé — la promesse n'existe pas");
} else ok("annulation: le portail client est branché (createPortalSession)");

if (!/useCustomerPortal/.test(subscriptionSrc)) {
  fail("SubscriptionCard: n'ouvre pas le portail client de Lemon Squeezy");
} else ok("annulation: la carte d'abonnement ouvre le portail officiel");

/* L'URL du portail est SIGNÉE et expire : la stocker serait la servir
   périmée. Elle est demandée au clic, jamais conservée. */
if (/portalUrl|portal_url|sellerUrl|portalURL/.test(subscriptionSrc)) {
  fail("SubscriptionCard: l'URL du portail est stockée au lieu d'être demandée au clic");
} else ok("annulation: l'URL signée est demandée au clic, jamais stockée");

const cardMounts = (landingSrc.match(/<SubscriptionCard\b/g) ?? []).length;
if (cardMounts !== 1) fail(`landing: ${cardMounts} montage(s) de SubscriptionCard (1 attendu)`);
else ok("annulation: la carte est montée pour un compte connecté");

/* ── 7 · CHIFFRES VÉRIFIABLES ───────────────────────────────────────── */

/**
 * Le nombre de LANGUES se lit dans `LANGUAGES` (src/convex/languages.ts),
 * source de vérité du produit. La copy de CHAQUE langue doit annoncer ce
 * même nombre : un chiffre qui diverge de sa base est une promesse non
 * tenue, même quand c'est la base qui change.
 */
const languagesTable = read("src/convex/languages.ts");
const LANGUAGES = (languagesTable.match(/^\s+code: "/gm) ?? []).length;

const mismatched = [];
for (const lang of UPGRADE_LANGS) {
  const printed = getLandingCopy(lang)?.landing?.features?.languagesValue;
  if (printed === undefined) continue;
  if (Number(String(printed).replace(/\D/g, "")) !== LANGUAGES) {
    mismatched.push(`${lang}: « ${printed} »`);
  }
}
if (mismatched.length) {
  fail(`langues: la copy annonce ${mismatched.join(", ")}, languages.ts en compte ${LANGUAGES}`);
} else {
  ok(`langues: les 12 langues annoncent ${LANGUAGES} = languages.ts`);
}

const charactersTable = read("src/convex/aiCharacters.ts");
const CHARACTERS = (charactersTable.match(/^\s+id: "/gm) ?? []).length;
if (CHARACTERS !== 8) {
  fail(`personnages: la table en compte ${CHARACTERS}, la copy en annonce 8`);
} else if (!new RegExp(`\\b${CHARACTERS} personnages\\b`).test(landingSrc)) {
  fail("personnages: la copy ne reprend plus le nombre de la table");
} else {
  ok(`personnages: ${CHARACTERS} = aiCharacters.ts, et la copy le reprend`);
}

/* Le total d'expressions n'a PAS de source statique ici : il est calculé
   par Convex (`landingStats.getLandingNumbers`) depuis la base. */
skip("expressions: total calculé par Convex (landingStats), aucune source statique à confronter");

/* ── 8 · ORDRE DU FUNNEL (src/pages/Landing.tsx) ────────────────────── */

{
  const at = (needle) => landingSrc.indexOf(needle);
  const order = [
    ["methods", at('id="methode"')],
    ["modules", at('id="modules"')],
    ["argot", at('id="argot"')],
    ["langues", at('id="langues"')],
    ["pricing", at('id="pricing"')],
  ].filter(([, i]) => i !== -1);

  const labels = order.map(([n]) => n);
  if (labels.length < 3) {
    fail("funnel: les ancres de section sont introuvables dans Landing.tsx");
  } else {
    const unordered = order.filter(([, i], k) => k > 0 && i < order[k - 1][1]);
    if (unordered.length) {
      fail(`funnel: « ${unordered[0][0]} » arrive avant la section précédente`);
    } else {
      ok(`funnel: ordre des sections ${labels.join(" → ")}`);
    }
  }

  /* L'offre ne doit pas être proposée avant une valeur vécue. */
  const argot = at('id="argot"');
  const pricing = at('id="pricing"');
  if (argot === -1 || pricing === -1 || pricing < argot) {
    fail("funnel: le prix s'affiche avant la valeur (argot non montré avant l'offre)");
  } else ok("funnel: le prix vient après la vitrine d'argot");

  /* Le CTA final vient APRÈS le prix (le pic-fin se referme sur l'action). */
  const finalCta = at("Commence ton immersion.");
  if (pricing === -1 || finalCta === -1 || finalCta < pricing) {
    fail("funnel: le CTA final n'est plus après la section de prix");
  } else ok("funnel: le CTA final clôt la page après le prix");
}

/* ── MODULES DU DÉPÔT D'ORIGINE — ABSENTS ICI, DONC SKIP EXPLICITE ──── */

/* Vitrine d'argot confrontée au catalogue : n'existe pas dans ce dépôt
   (ni `src/lib/argotShowcase.ts`, ni `slang-catalog.json`). Le contrôle se
   réactive de lui-même si ces fichiers reviennent. */
if (has("src/lib/argotShowcase.ts") && has("slang-catalog.json")) {
  const { SHOWCASE_ALL } = await import("../src/lib/argotShowcase.ts");
  const catalog = JSON.parse(read("slang-catalog.json"));
  const byId = new Map(catalog.entries.map((e) => [e.id, e]));
  const problems = [];
  for (const s of SHOWCASE_ALL) {
    const e = byId.get(s.catalogId);
    if (!e) problems.push(`${s.lang}/${s.word}: identifiant absent du catalogue (${s.catalogId})`);
    else if (e.word !== s.word || e.language !== s.lang) problems.push(`${s.lang}/${s.word}: entrée « ${e.word} » (${e.language})`);
    else if (s.context !== (e.example || e.context)) problems.push(`${s.lang}/${s.word}: contexte réécrit`);
    else if (s.catalogCount !== catalog.meta.byLanguage[s.lang]) problems.push(`${s.lang}/${s.word}: effectif annoncé ≠ catalogue`);
  }
  if (problems.length) fail(`vitrine argot: ${problems.length} écart(s) au catalogue\n        ${problems.join("\n        ")}`);
  else ok(`vitrine argot: ${SHOWCASE_ALL.length} mots réels (identifiant, sens, contexte, effectif)`);
} else {
  skip("vitrine argot: src/lib/argotShowcase.ts absent de ce dépôt (landing monolithique)");
}

/* Galerie 3D (`GALLERY_AVATARS`) : `src/lib/avatarKit.ts` n'a jamais été
   versionné ici. Le contrôle se réactive s'il réapparaît. */
if (has("src/lib/avatarKit.ts")) {
  const { GALLERY_AVATARS } = await import("../src/lib/avatarKit.ts");
  if (GALLERY_AVATARS.length < 6) fail(`galerie 3D: ${GALLERY_AVATARS.length} modèles, le brief en demandait 6 à 10`);
  else ok(`galerie 3D: ${GALLERY_AVATARS.length} modèles`);
} else {
  skip("galerie 3D: src/lib/avatarKit.ts absent de ce dépôt");
}

/* ── Verdict ─────────────────────────────────────────────────────────── */

console.log("");
if (skipped) console.log(`${skipped} contrôle(s) non applicable(s) ici (voir les « skip » ci-dessus).`);
if (failures === 0) {
  console.log(
    "CONVERSION : copy 12/12 OK + 0 PATTERN INTERDIT + MONTANTS DÉRIVÉS + CAISSE HONNÊTE + ANNULATION OK + CHIFFRES = TABLES + FUNNEL ORDONNÉ ✓",
  );
  process.exit(0);
}
console.log(`${failures} contrôle(s) en échec`);
process.exit(1);
