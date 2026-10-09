/* ═══════════════════════════════════════════════════════════════════
   CONVERSION — CONTRÔLE D'HONNÊTÉ (Module D du lot « conversion »)

   Les techniques comportementales de ce lot ne valent que si ce script
   passe. Il vérifie quatre choses, toutes vérifiables sans navigateur :

   1. COPY COMPLÈTE — les 12 langues d'interface portent les 3 moments
      post-engagement, sinon un utilisateur swahili verrait un rappel en
      français sous son header (le défaut exact que `verify-avatar-i18n.mjs`
      existe pour empêcher ailleurs).

   2. PATTERNS INTERDITS — le brief les énumère, on les grep littéralement :
      compte à rebours, fausse urgence, fausse rareté, case pré-cochée,
      vocabulaire de perte, dissimulation de l'information. Chaque motif est
      cherché dans les fichiers de copy et de composants touchés par le lot.

   3. HIÉRARCHIE — un seul CTA principal par section. On compte les boutons
      primaires (gradient doré plein) par section de la landing et dans le
      moment post-engagement : plus d'un, c'est un échec.

   4. CHIFFRES VÉRIFIABLES — chaque nombre affiché est confronté à la
      source de vérité du dépôt (catalogue d'expressions, table des
      langues, table des personnages). Un chiffre qui diverge de sa base est
      une promesse non tenue, même si la base est la seule à changer.

   5. ARGOT RÉEL (Module A de la refonte immersive) — chaque mot affiché
      par la vitrine doit exister dans `slang-catalog.json`, avec le même
      identifiant, le même contexte et le même effectif par langue. Le
      mot « réel » de la page est donc une propriété vérifiable.

   6. PRIX (Module C) — la copy des tarifs et l'ancrage « par jour » sont
      confrontés à `lib/pricing.ts`. L'ancrage ne doit contenir AUCUN
      chiffre écrit à la main : on n'invente pas de statistique sur le coût
      de la route seule.

   7. ORDRE DU FUNNEL (Module B) — l'offre ne doit pas précéder la valeur
      vécue, et le pic doit précéder immédiatement le CTA final.

   Usage : `node scripts/verify-upgrade.mjs`
   ═══════════════════════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { UPGRADE_LANGS, UPGRADE_MOMENT_KEYS, getUpgradeCopy } from "../src/lib/i18n.upgrade.ts";
import { GALLERY_AVATARS } from "../src/lib/avatarKit.ts";
import { SHOWCASE_ALL } from "../src/lib/argotShowcase.ts";
import {
  PREMIUM,
  premiumPerDayEur,
  premiumAnnualDiscountPct,
} from "../src/lib/pricing.ts";

let failures = 0;
const ok = (msg) => console.log(`ok   ${msg}`);
const fail = (msg) => {
  console.log(`FAIL ${msg}`);
  failures++;
};

/* ── 1 · COPY DES 12 LANGUES ─────────────────────────────────────────── */

const TEXT_KEYS = ["badge", "cta", "dismiss", "note"];

for (const lang of UPGRADE_LANGS) {
  const copy = getUpgradeCopy(lang);
  if (!copy) {
    fail(`${lang}: aucune copy`);
    continue;
  }
  const up = copy.upgrade;
  const missing = TEXT_KEYS.filter((k) => !up[k]);
  for (const m of UPGRADE_MOMENT_KEYS) if (!up.moments[m]) missing.push(`moments.${m}`);
  if (missing.length) fail(`${lang}: ${missing.length} clé(s) manquante(s) → ${missing.join(", ")}`);
  else ok(`${lang}: ${TEXT_KEYS.length + UPGRADE_MOMENT_KEYS.length} clés complètes`);
}

if (UPGRADE_LANGS.length !== 12) fail(`12 langues attendues, ${UPGRADE_LANGS.length} trouvées`);

/* ── 2 · PATTERNS INTERDITS (Module D) ───────────────────────────────── */

/* Motifs globaux :/matche n'importe où, insensible à la casse. */
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
  { re: /\b(stock|inventaire)\s+(limite|faible|faible)\b/i, why: "fausse rareté" },
  // Case pré-cochée / friction cachée
  { re: /defaultChecked/, why: "case pré-cochée" },
  { re: /\b(pre-?coch[eé]|coch[eé]\s+par\s+d[ée]faut)\b/i, why: "case pré-cochée" },
  { re: /<input[^>]*type=["']checkbox["'][^>]*checked(?![=])/i, why: "case pré-cochée" },
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

const FILES = [
  "src/lib/i18n.upgrade.ts",
  "src/lib/i18n.landing.ts",
  "src/components/learner/UpgradeMoment.tsx",
  "src/components/landing/Convert.tsx",
  "src/components/landing/Hero.tsx",
  "src/components/landing/Demo.tsx",
  "src/components/landing/Argot.tsx",
  "src/pages/Landing.tsx",
];

for (const file of FILES) {
  const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
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
  if (hits.length) fail(`${file}: ${hits.length} motif(s) interdit(s)\n      ${hits.join("\n      ")}`);
  else ok(`${file}: aucun pattern interdit`);
}

/* ── 3 · UN SEUL CTA PRINCIPAL PAR SECTION ───────────────────────────── */

const convert = readFileSync(
  new URL("../src/components/landing/Convert.tsx", import.meta.url),
  "utf8",
);
const hero = readFileSync(
  new URL("../src/components/landing/Hero.tsx", import.meta.url),
  "utf8",
);
const demo = readFileSync(
  new URL("../src/components/landing/Demo.tsx", import.meta.url),
  "utf8",
);
const moment = readFileSync(
  new URL("../src/components/learner/UpgradeMoment.tsx", import.meta.url),
  "utf8",
);

/** Le gradient doré plein = bouton principal. */
const PRIMARY = /ln-shine[^"]*bg-gradient-to-r from-gold to-gold-soft/g;
const lnShineHero = /ln-glow[^"]*bg-gradient-to-r from-gold to-gold-soft/g;
const count = (src, re) => (src.match(re) ?? []).length;

/* Sections de la landing : on découpe sur `export function X` et on compte
   les CTA principaux de chacune. Le héros a son propre attribut (ln-glow). */
const sections = convert.split(/\nexport function /).slice(1);
for (const section of sections) {
  const name = section.slice(0, section.indexOf("{")).trim();
  const n = count(section, PRIMARY);
  if (n > 1) fail(`section ${name}: ${n} CTA principaux (max 1)`);
  else ok(`section ${name}: ${n} CTA principal`);
}

const heroPrimary = count(hero, lnShineHero) + count(hero, PRIMARY);
if (heroPrimary > 1) fail(`Hero: ${heroPrimary} CTA principaux (max 1)`);
else ok(`Hero: ${heroPrimary} CTA principal`);

/* La Démo a son propre fichier : un seul CTA principal (le bouton
   « analyser »), le passage à l'inscription reste un lien. */
const demoPrimary = count(demo, /bg-gradient-to-r from-gold to-gold-soft/g);
if (demoPrimary > 1) fail(`Demo: ${demoPrimary} CTA principaux (max 1)`);
else ok(`Demo: ${demoPrimary} CTA principal`);

// Le moment post-engagement : un seul bouton d'action (le CTA). Le bouton
// de fermeture est un `X` sans CTA, il ne compte pas.
const momentPrimary = count(moment, /bg-gradient-to-r from-gold to-gold-soft/g);
if (momentPrimary !== 1) fail(`UpgradeMoment: ${momentPrimary} CTA principaux (1 attendu)`);
else ok("UpgradeMoment: 1 CTA principal");

/* MODULE B (lot « paiement ») — le bouton Premium est une vraie CAISSE.
   Ce qu'on vérifie n'est plus « pas de bouton payer », mais l'inverse :
   · la landing monte bien `PremiumCta` (pas un lien vers l'inscription
     déguisé en bouton de paiement) ;
   · `PremiumCta` dégrade EXPLICITEMENT en « bientôt disponible » quand le
     serveur n'a pas confirmé le prestataire — c'est la condition pour
     qu'un bouton de paiement puisse exister sans mentir.
   Un bouton « payer » écrit en dur dans la landing, lui, reste un échec :
   il n'aurait ni l'accès, ni le repli, ni la caisse. */
const premiumCta = readFileSync(
  new URL("../src/components/learner/PremiumCta.tsx", import.meta.url),
  "utf8",
);
const paymentsLib = readFileSync(
  new URL("../src/lib/payments.ts", import.meta.url),
  "utf8",
);
if (!/<PremiumCta\b/.test(convert)) {
  fail("Pricing: le bouton Premium ne monte pas PremiumCta (il mènerait à l'inscription)");
} else ok("Pricing: le bouton Premium est une caisse (PremiumCta)");

if (!/createCheckoutSession/.test(paymentsLib)) {
  fail("lib/payments: n'appelle pas createCheckoutSession — le bouton ne paie donc rien");
} else ok("lib/payments: appelle createCheckoutSession");

/* Le repli « bientôt disponible » doit être câblé des deux côtés : le
   composant l'affiche, la lib lit l'état du serveur. */
if (!/usePaymentsReady/.test(premiumCta) || !/soonMessage/.test(premiumCta)) {
  fail(
    "PremiumCta: sans repli sur « bientôt disponible » quand le prestataire n'est pas confirmé, le bouton promettrait une caisse qui échoue",
  );
} else ok("PremiumCta: repli « bientôt disponible » quand le prestataire n'est pas prêt");

if (!/checkoutReady/.test(paymentsLib)) {
  fail(
    "lib/payments: l'état « le prestataire est-il prêt ? » n'est pas lu — le bouton ne peut pas savoir s'il doit promettre une caisse",
  );
} else ok("lib/payments: l'état du prestataire est lu avant de promettre une caisse");

/* Le prix affiché et le prix encaissé doivent venir de la même source :
   ni le bouton ni la lib ne doivent contenir de montant. */
if (/\d+[.,]?\d*\s*€|\b\d{2,}[.,]\d{2}\b/.test(premiumCta + paymentsLib)) {
  fail("bouton de paiement: un montant est écrit en dur (tout doit venir de lib/pricing.ts)");
} else ok("bouton de paiement: aucun montant en dur (tout vient de lib/pricing.ts)");

/* ── 4 · CHIFFRES VÉRIFIABLES ────────────────────────────────────────── */

const catalog = JSON.parse(
  readFileSync(new URL("../slang-catalog.json", import.meta.url), "utf8"),
);
const EXPRESSIONS = catalog.meta.totalEntries;

/**
 * Le nombre de LANGUES D'APPRENTAGE se lit dans `LANGUAGES`
 * (src/convex/languages.ts), pas dans le catalogue d'expressions : le
 * catalogue contient aussi du `fr`, qui est la langue de l'interface et la
 * cible des traductions, pas une langue enseignée. Compter les clés distinctes
 * du catalogue donnerait 12 et ferait crier le contrôle à tort ; prendre
 * `LANGUAGES` aligne la copy sur la seule source de vérité du produit.
 */
const languagesTable = readFileSync(
  new URL("../src/convex/languages.ts", import.meta.url),
  "utf8",
);
const LANGUAGES = (languagesTable.match(/^\s+code: "/gm) ?? []).length;

const characters = readFileSync(
  new URL("../src/convex/aiCharacters.ts", import.meta.url),
  "utf8",
);
const CHARACTERS = (characters.match(/^\s+id: "/gm) ?? []).length;

const landing = readFileSync(
  new URL("../src/lib/i18n.landing.ts", import.meta.url),
  "utf8",
);

const claims = [
  { label: "expressions", printed: /2\s?363/, value: EXPRESSIONS, base: "slang-catalog.json" },
  { label: "langues", printed: /\b11 langues\b|\ball 11\b/, value: LANGUAGES, base: "languages.ts" },
  { label: "personnages", printed: /8 personnages|\b8 AI characters\b/, value: CHARACTERS, base: "aiCharacters.ts" },
];

for (const c of claims) {
  if (!c.printed.test(landing)) {
    fail(`${c.label}: le nombre annoncé (${c.value}) n'apparaît plus dans la copy`);
  } else if (c.label === "expressions") {
    const printed = landing.match(/(\d[\d\s]*) expressions réelles/);
    const n = printed ? Number(printed[1].replace(/\s/g, "")) : NaN;
    if (n !== EXPRESSIONS) fail(`expressions: la copy annonce ${n}, le catalogue en compte ${EXPRESSIONS}`);
    else ok(`expressions: ${n} = catalogue (${c.base})`);
  } else if (c.label === "langues") {
    if (LANGUAGES !== 11) fail(`langues: LANGUAGES en compte ${LANGUAGES}, la copy en annonce 11`);
    else ok(`langues: 11 = LANGUAGES (${c.base})`);
  } else {
    if (CHARACTERS !== 8) fail(`personnages: la table en compte ${CHARACTERS}, la copy en annonce 8`);
    else ok(`personnages: 8 = table (${c.base})`);
  }
}

/* Le nombre de personnages proposé dans la galerie 3D doit rester
   cohérent avec ce que l'app sait afficher. */
if (GALLERY_AVATARS.length < 6) {
  fail(`galerie 3D: ${GALLERY_AVATARS.length} modèles, le brief en demandait 6 à 10`);
} else ok(`galerie 3D: ${GALLERY_AVATARS.length} modèles`);

/* MODULE D — il y a MAINTENANT un abonnement, donc la promesse de la FAQ
   (« l'annulation est en un clic, depuis les réglages ») doit être tenue :
   le chemin doit exister dans l'application. Un parcours d'annulation
   qui n'existe pas serait une promesse commerciale enivrante — pire
   qu'une absence de parcours.
   Inversement, on refuse un formulaire de résiliation MAISON : Lemon
   Squeezy est le Marchand of Record, c'est lui qui détient la carte et la
   comptabilité ; un formulaire chez nous produirait une demande à
   traiter en différé, pendant que l'abonnement continue de facturer. */
const subscriptionCard = readFileSync(
  new URL("../src/components/learner/SubscriptionCard.tsx", import.meta.url),
  "utf8",
);
const settings = readFileSync(
  new URL("../src/components/openverse/views.tsx", import.meta.url),
  "utf8",
);

if (!/createPortalSession/.test(subscriptionCard + paymentsLib)) {
  fail("annulation: le portail client n'est jamais appelé — la promesse n'existe pas");
} else ok("annulation: le portail client est branché (createPortalSession)");

if (!/<SubscriptionCard\b/.test(settings)) {
  fail("Paramètres: la carte d'abonnement n'est pas montée — « en un clic, depuis les réglages » est faux");
} else ok("annulation: accessible depuis les réglages, comme la FAQ le promet");

/* Le portail est SIGNÉ et expire : le stocker serait le servir périmé. */
if (/customer_portal[^\n]*=>/.test(subscriptionCard)) {
  fail("SubscriptionCard: l'URL du portail est stockée au lieu d'être demandée au clic");
} else ok("portail: l'URL signée est demandée au clic, jamais stockée");

/* ── 5 · ARGOT RÉEL (vitrine de la landing) ─────────────────────────── */

/**
 * Le mot affiché DOIT être un mot du catalogue : même identifiant, même
 * langue, et le contexte affiché doit être celui du catalogue. Une page
 * qui affiche un mot écrit « pour la landing » échoue ici.
 */
{
  const byId = new Map(catalog.entries.map((e) => [e.id, e]));
  const problems = [];

  for (const s of SHOWCASE_ALL) {
    const e = byId.get(s.catalogId);
    if (!e) {
      problems.push(`${s.lang}/${s.word}: identifiant absent du catalogue (${s.catalogId})`);
      continue;
    }
    if (e.word !== s.word || e.language !== s.lang) {
      problems.push(`${s.lang}/${s.word}: l'entrée ${s.catalogId} est « ${e.word} » (${e.language})`);
    }
    const catalogContext = e.example || e.context;
    if (s.context !== catalogContext) {
      problems.push(`${s.lang}/${s.word}: contexte réécrit au lieu d'être recopié du catalogue`);
    }
    if (s.meaning !== e.meaning) {
      problems.push(`${s.lang}/${s.word}: sens réécrit au lieu d'être recopié du catalogue`);
    }
    if (s.region !== e.region) {
      problems.push(`${s.lang}/${s.word}: région réécrite au lieu d'être recopiée du catalogue`);
    }
    const real = catalog.meta.byLanguage[s.lang];
    if (s.catalogCount !== real) {
      problems.push(
        `${s.lang}/${s.word}: la page annonce ${s.catalogCount} expressions, le catalogue en compte ${real}`,
      );
    }
  }

  if (problems.length) {
    fail(`vitrine argot: ${problems.length} écart(s) au catalogue\n      ${problems.join("\n      ")}`);
  } else {
    ok(`vitrine argot: ${SHOWCASE_ALL.length} mots réels (identifiant, sens, contexte, région, effectif)`);
  }

  /* Les 6 langues à identité visuelle doivent toutes être présentes : c'est
     ce qui fait basculer le décor quand le visiteur choisit. */
  const accented = new Set(["wo", "sw", "ln", "ha", "yo", "zu"]);
  const featured = SHOWCASE_ALL.filter((e) => e.featured).map((e) => e.lang);
  const missingAccent = [...accented].filter((l) => !featured.includes(l));
  if (missingAccent.length) {
    fail(`vitrine argot: langues à identité visuelle absentes → ${missingAccent.join(", ")}`);
  } else {
    ok("vitrine argot: les 6 langues à identité visuelle sont mises en avant");
  }

  /* MODULE A.3 — l'aperçu du héros n'affiche qu'UNE sortie, et elle vient du
     catalogue. Les trois anciennes clés de badges ne doivent pas revenir :
     ce sont elles qui remettront trois promesses simultanées en première
     image si quelqu'un les réintroduit. */
  const heroSrc = readFileSync(
    new URL("../src/components/landing/Hero.tsx", import.meta.url),
    "utf8",
  );
  const zombieKeys = ["badgeArgot", "badgeVoice", "badgeChat"].filter((k) =>
    heroSrc.includes(k),
  );
  if (zombieKeys.length) {
    fail(`héros: badges multiples réintroduits → ${zombieKeys.join(", ")}`);
  } else if (!/outputLine.*\{\s*word\s*\}/.test(landing)) {
    fail("héros: la ligne de sortie n'injecte plus le mot réel du catalogue ({word})");
  } else {
    ok("héros: une seule sortie, et c'est un mot du catalogue");
  }
}

/* ── 6 · PRIX ET ANCRAGE HONNÊTE (Module C) ─────────────────────────── */

/* La copy des tarifs doit correspondre à la source unique des montants. */
{
  const monthly = landing.match(/premium: \{[\s\S]*?price: "([\d.,]+)€/);
  const annual = landing.match(/annualNote: "[^"]*?([\d.,]+)€/);
  const discount = landing.match(/-(\d+)%/);

  const toNumber = (s) => Number(s.replace(/\./g, "").replace(",", "."));

  if (!monthly) {
    fail("prix mensuel introuvable dans la copy");
  } else if (toNumber(monthly[1]) !== PREMIUM.monthlyEur) {
    fail(
      `prix mensuel: la copy affiche ${monthly[1]} €, lib/pricing.ts dit ${PREMIUM.monthlyEur} €`,
    );
  } else ok(`prix mensuel: ${monthly[1]} € = lib/pricing.ts`);

  if (annual && toNumber(annual[1]) !== PREMIUM.annualEur) {
    fail(
      `prix annuel: la copy affiche ${annual[1]} €, lib/pricing.ts dit ${PREMIUM.annualEur} €`,
    );
  } else ok(`prix annuel: ${annual ? annual[1] : "?"} € = lib/pricing.ts`);

  const realDiscount = premiumAnnualDiscountPct();
  if (!discount) {
    fail("la remise annuelle annoncée a disparu de la copy");
  } else if (Number(discount[1]) !== realDiscount) {
    fail(
      `remise annuelle: la copy annonce -${discount[1]} %, le calcul réel donne -${realDiscount} %`,
    );
  } else ok(`remise annuelle: -${realDiscount} % = calcul (${PREMIUM.annualEur} vs ${PREMIUM.monthlyEur}×12)`);

  /* L'ancrage doit afficher le prix par jour CALCULÉ, jamais recopié. */
  const perDay = premiumPerDayEur();
  const anchorLine = landing.match(/perDay: "([^"]+)"/);
  if (!anchorLine) {
    fail("l'ancrage de prix a disparu de la copy");
  } else if (!anchorLine[1].includes("{perDay}")) {
    fail("l'ancrage écrit le prix par jour en dur au lieu du placeholder {perDay}");
  } else ok(`ancrage: le prix par jour vient du calcul (${perDay})`);

  /* Aucun chiffre inventé dans le coût de « la route seule » : on décrit
     une expérience, on n'invente pas une statistique. */
  const items = landing.match(/anchor: \{[\s\S]*?items: \[([\s\S]*?)\]/);
  if (!items) {
    fail("les items de l'ancrage sont introuvables");
  } else if (/\d/.test(items[1])) {
    fail("l'ancrage contient un chiffre qui ne vient d'aucune source vérifiable");
  } else ok("ancrage: aucun chiffre inventé sur le coût de la route seule");
}

/* ── 7 · ORDRE DU FUNNEL (Module B + pic-fin) ───────────────────────── */

{
  const page = readFileSync(new URL("../src/pages/Landing.tsx", import.meta.url), "utf8");
  const at = (needle) => page.indexOf(needle);
  const order = [
    ["Hero", at("<Hero")],
    ["FirstTaste", at("<FirstTaste")],
    ["Demo", at("<Demo")],
    ["PriceAnchor", at("<PriceAnchor")],
    ["Pricing", at("<Pricing")],
    ["Faq", at("<Faq")],
    ["Voices", at("<Voices")],
    ["FinalCta", at("<FinalCta")],
  ].filter(([, i]) => i !== -1);

  const wrong = order.filter(([, i], k) => k > 0 && i < order[k - 1][1]);
  if (wrong.length) {
    fail(`ordre du funnel: ${wrong[0][0]} arrive avant ${order[order.findIndex((o) => o[0] === wrong[0][0]) - 1][0]}`);
  } else {
    ok(`ordre du funnel: ${order.map(([n]) => n).join(" → ")}`);
  }

  /* L'offre ne doit pas être proposée avant une valeur vécue. */
  if (at("<FirstTaste") > at("<Pricing")) {
    fail("l'offre s'affiche avant la première dose de valeur");
  } else ok("l'offre n'apparaît qu'après l'argot réel et la démo");

  /* Le pic doit être immédiatement avant le CTA final (règle du pic-fin). */
  if (at("<FinalCta") - at("<Voices") > 600) {
    fail("le pic (Voices) n'est pas collé au CTA final : autre chose s'intercale");
  } else ok("le pic précède immédiatement le CTA final");

  /* Dans la démo, la ligne « abonnement » doit vivre dans le bloc de
     résultat : hors de là, elle s'afficherait avant toute valeur vécue. */
  const demoSrc = readFileSync(
    new URL("../src/components/landing/Demo.tsx", import.meta.url),
    "utf8",
  );
  const okGate = demoSrc.indexOf("result?.ok");
  const offer = demoSrc.indexOf("afterResult");
  if (okGate === -1 || offer === -1 || offer < okGate) {
    fail("la ligne d'abonnement de la démo n'est plus conditionnée par un résultat réussi");
  } else ok("l'abonnement n'est proposé qu'après une analyse réussie");
}

/* ── Verdict ─────────────────────────────────────────────────────────── */

console.log("");
if (failures === 0) {
  console.log(
    "CONVERSION 12/12 + 0 PATTERN INTERDIT + 1 CTA/SECTION + ARGOT RÉEL + PRIX JUSTE + FUNNEL ORDONNÉ ✓",
  );
  process.exit(0);
}
console.log(`${failures} contrôle(s) en échec`);
process.exit(1);
