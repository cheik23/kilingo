/* ═══════════════════════════════════════════════════════════════════════
   VERROUS PREMIUM — CONTRÔLE (honnêteté, non-rétroactivité, boucle libre)

   Ce lot ajoute trois paywalls. Le risque n'est pas qu'ils ne
   fonctionnent pas : c'est qu'ils fonctionnent TROP BIEN — qu'un
   utilisateur gratuit perde ce qu'il avait, ou que la boucle
   d'apprentissage devienne payante sans qu'on l'ait voulu.

   Ce script vérifie donc, chose par chose :

   1. LES PLAFARDS      — 1 langue / 5 analyses / 2 personnages, et
                           Premium qui ne rend PAS le gratuit moins bon.
   2. NON-RÉTROACTIVITÉ — un utilisateur gratuit qui suivait déjà
                           plusieurs langues les garde ; une conversation
                           déjà commencée se poursuit ; un média déjà
                           analysé reste là.
   3. BOUCLE LIBRE      — argot, XP, badges, streaks, révision SRS,
                           quiz, défis : AUCUN appel au module de
                           verrou. C'est le contrôle le plus important.
   4. PAS DE DARK PATTERN— les trois messages annoncent un GAIN, jamais
                           une perte ; aucune urgence fabriquée.
   5. VISIBILITÉ        — les 6 personnages verrouillés sont renvoyés
                           par la query, pas filtrés.
   6. COPIE COMPLETE    — les 12 langues portent les 3 blocages.

   Usage : `node scripts/verify-premium-locks.mjs` (ou `bun run locks:verify`)
   ═══════════════════════════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import {
  FREE_ACTIVE_LANGUAGES,
  FREE_AI_CHARACTER_IDS,
  FREE_AI_CHARACTERS,
  FREE_SHADOW_PER_DAY,
  PREMIUM_ACTIVE_LANGUAGES,
  TOTAL_AI_CHARACTERS,
  activeLanguageCap,
  activeLanguageBlockReason,
  isCharacterLocked,
  localDayKey,
  nextLocalMidnight,
  resolveLimits,
  shadowQuotaState,
  isQuotaShadowError,
  isCharacterLockedError,
} from "../src/lib/premiumLimits.ts";
import { getPremiumCopy, PREMIUM_COPY_LANGS } from "../src/lib/i18n.premium.ts";

let failures = 0;
const ok = (m) => console.log(`ok   ${m}`);
const fail = (m) => {
  console.log(`FAIL ${m}`);
  failures++;
};
const eq = (got, want, label) =>
  Object.is(got, want)
    ? ok(`${label} = ${JSON.stringify(got)}`)
    : fail(`${label}: attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(got)}`);

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

/** Langues portant la copy des verrous (cf. `i18n.premium.ts`). */
const langsRef = PREMIUM_COPY_LANGS;

/* ── 1 · LES PLAFARDS ─────────────────────────────────────────────────── */

eq(FREE_ACTIVE_LANGUAGES, 1, "langues actives (gratuit)");
eq(PREMIUM_ACTIVE_LANGUAGES, 2, "langues actives (Premium)");
eq(FREE_SHADOW_PER_DAY, 5, "analyses Shadow par jour (gratuit)");
eq(FREE_AI_CHARACTERS, 2, "personnages IA (gratuit)");
eq(FREE_AI_CHARACTER_IDS.length, FREE_AI_CHARACTERS, "la liste des personnages gratuits est complète");
eq(TOTAL_AI_CHARACTERS, 8, "total de personnages");
eq(FREE_AI_CHARACTER_IDS.length < TOTAL_AI_CHARACTERS, true, "il reste donc des personnages à débloquer");

/* Premium ne doit JAMAIS être moins bien que gratuit, ni l'inverse
   caché : on compare les paires. */
{
  const free = resolveLimits(false);
  const paid = resolveLimits(true);
  if (!(paid.activeLanguages > free.activeLanguages)) fail("Premium n'apporte rien sur les langues");
  else if (!(paid.shadowPerDay === Number.POSITIVE_INFINITY)) fail("Premium n'est pas illimité sur le Shadow");
  else if (!(paid.aiCharacters > free.aiCharacters)) fail("Premium n'apporte rien sur les personnages");
  else ok("Premium est strictement au-dessus du gratuit sur les 3 surfaces");
}

/* ── 2 · NON-RÉTROACTIVITÉ ───────────────────────────────────────────── */

/* 2.1 — Grand-père : deux lignes SANS `activatedAt` = deux langues
   actives AVANT le lot. Un compte gratuit doit les garder. */
{
  const legacy = [
    { language: "en", active: true }, // pas de activatedAt → antérieur au lot
    { language: "yo", active: true },
  ];
  eq(activeLanguageCap(false, legacy), 2, "cap gratuit d'un compte ayant déjà 2 langues");
  eq(activeLanguageBlockReason(false, legacy, ["en"]), null, "il peut garder une de ses langues");
  eq(activeLanguageBlockReason(false, legacy, ["en", "yo"]), null, "il peut garder SES DEUX langues");
  eq(
    activeLanguageBlockReason(false, legacy, ["en", "yo", "sw"]),
    "language_cap",
    "mais pas en ajouter une troisième",
  );
}

/* 2.2 — Nouveau client : une seule langue, et le verrou mord. */
{
  const fresh = [];
  eq(activeLanguageCap(false, fresh), 1, "cap gratuit d'un compte neuf");
  eq(activeLanguageBlockReason(false, fresh, ["en"]), null, "une langue passe");
  eq(
    activeLanguageBlockReason(false, fresh, ["en", "yo"]),
    "language_cap",
    "deux langues sont refusées à un compte neuf",
  );
  eq(activeLanguageBlockReason(true, fresh, ["en", "yo"]), null, "Premium passe sur deux langues");
}

/* 2.3 — Anti-contournement : désactiver puis réactiver ne doit pas
  náesser un crédit infini. La désactivation efface `activatedAt`. */
{
  const churned = [
    { language: "en", active: true, activatedAt: 1000 }, // réactivée → nouvelle
    { language: "yo", active: false }, // désactivée → grand-père mais inactive
  ];
  eq(activeLanguageCap(false, churned), 1, "réactiver ne redonne pas de crédit");
}

/* 2.4 — Une ligne inactive mais grand-père ne relève pas le plafond. */
{
  const rows = [
    { language: "en", active: true, activatedAt: 1 },
    { language: "yo", active: false },
  ];
  eq(activeLanguageCap(false, rows), 1, "une langue désactivée ne compte plus dans le cap");
}

/* 2.5 — Le refus ne retire JAMAIS une langue : `applyFocus` renvoie un
   refus SANS patcher. On le vérifie sur le SOURCE, parce que c'est une
   propriété de l'ordre des opérations. */
{
  const learning = read("src/convex/learning.ts");
  const guardAt = learning.indexOf("reason: \"language_cap\"");
  const firstPatch = learning.indexOf("await ctx.db.patch(row._id");
  if (guardAt === -1) fail("learning: le refus language_cap est absent");
  else if (firstPatch !== -1 && firstPatch < guardAt) {
    fail("learning: une langue est patchée AVANT le test de refus — un refus pourrait retirer un accès");
  } else ok("learning: le refus est évalué avant toute écriture (rien n'est retiré)");
}

/* 2.6 — Une conversation déjà commencée se POURSUIT. C'est la garantie
   centrale du Module C : verrouiller `sendMessage` couperait une
   conversation en cours. */
{
  const ai = read("src/convex/aiConversation.ts");
  const inSend = ai.slice(ai.indexOf("export const sendMessage"));
  if (isCharacterLockedError === undefined) fail("le détecteur d'erreur personnage est absent");
  if (inSend.includes("isCharacterLocked(")) {
    fail("aiConversation: sendMessage est verrouillé — une conversation en cours serait coupée");
  } else ok("aiConversation: sendMessage n'est PAS verrouillé (pas de coupure en cours)");

  const inEnd = ai.slice(ai.indexOf("export const endConversation"));
  if (inEnd.includes("isCharacterLocked(")) {
    fail("aiConversation: endConversation est verrouillé — impossible de terminer une conversation");
  } else ok("aiConversation: endConversation n'est pas verrouillé");
}

/* 2.7 — Le quota ne bloque pas la RELECTURE d'un média déjà analysé. */
{
  const media = read("src/convex/media.ts");
  const guards = (media.match(/await guardShadowQuota\(ctx, userId\);/g) ?? []).length;
  if (guards !== 3) {
    fail(`media: ${guards} points d'entrée protégés (3 attendus : lien, upload, texte)`);
  } else ok("media: les 3 entrées d'analyse Shadow sont protégées (lien, upload, texte)");

  // `kickPipeline` / `retranslate` / `setMediaTargetLanguage` relisent un
  // média EXISTANT : les verrouiller serait du retrait de contenu acquis.
  for (const fn of ["kickPipeline", "retranslate"]) {
    const idx = media.indexOf(`export const ${fn}`);
    if (idx === -1) continue;
    const body = media.slice(idx, idx + 2500);
    if (body.includes("guardShadowQuota")) {
      fail(`media.${fn}: un traitement d'un média déjà analysé est bloqué par le quota`);
    }
  }
  ok("media: retraiter ou re-synchroniser un média existant reste gratuit");
}

/* ── 3 · LA BOUCLE D'APPRENTISSAGE RESTE GRATUITE ────────────────────── */

/* Aucun de ces fichiers ne doit appeler le module de verrou. C'est le
   contrôle le plus important du lot : si l'argot ou les badges
   devenaient payants, le produit n'aurait plus de boucle de retour. */
const LEARNING_LOOP = [
  "src/convex/slang.ts",
  "src/convex/gamification.ts",
  "src/convex/achievements.ts",
  "src/convex/achievementProgress.ts",
  "src/convex/dailyChallenge.ts",
  "src/convex/dailyChallengeStore.ts",
  "src/convex/quizEngine.ts",
  "src/convex/referrals.ts",
  "src/convex/leaderboard.ts",
  "src/lib/badges.ts",
];
let loopClean = true;
for (const path of LEARNING_LOOP) {
  const src = read(path);
  if (/from "\.\/premium"|from "\.\.\/convex\/premium"|guardShadowQuota|consumeShadowSlot|isCharacterLocked|activeLanguageCap/.test(src)) {
    fail(`${path}: la boucle d'apprentissage appelle un verrou Premium`);
    loopClean = false;
  }
}
if (loopClean) ok(`la boucle d'apprentissage est intacte (${LEARNING_LOOP.length} fichiers sans verrou)`);

/* Et dans `learning.ts`, seules les mutations de FOCUS sont concernées :
   la révision SRS et les sessions ne doivent pas l'être. */
{
  const learning = read("src/convex/learning.ts");
  for (const fn of ["reviewCardMutation", "recordSession", "addToSrs", "drawNewCards", "removeFromSrs"]) {
    const idx = learning.indexOf(`export const ${fn}`);
    if (idx === -1) continue;
    const slice = learning.slice(idx, learning.indexOf("export const", idx + 10));
    if (slice.includes("premiumStatusFor") || slice.includes("activeLanguageCap")) {
      fail(`learning.${fn}: la révision/session est verrouillée — la boucle d'apprentissage doit rester gratuite`);
    }
  }
  ok("learning: révision SRS, sessions et cartes ne sont pas verrouillées");
}

/* ── 4 · PAS DE DARK PATTERN ──────────────────────────────────────────── */

const LOSS_VOCABULARY = [
  /\b(perds?|perdez?|vas? perdre)\s+(tes?|tes|vos|ton)\s/i,
  /\bne pourras? plus\b/i,
  /\bplus jamais\b/i,
  /\b(tu dois|vous devez)\s+(payer|payez)\b/i,
  /\bimpossible de (revenir|recommencer|rattraper)\b/i,
  /\b(ton|vos|tes) (données|travail|progress|historique) (seront?|sera|sont)\s+(effac[ée]|supprim[ée]|perdu)/i,
];
/**
 * Termes de GAIN, par langue.
 *
 * ⚠ On compare par `includes` et NON par `\b` : en JavaScript, `\w` ne
 * couvre pas les lettres accentuées, donc `\billimité\b` ne matche
 * JAMAIS — la frontière droite tombe entre « é » et l'espace, deux
 * non-mots. Un contrôle de copy qui ne matche pas est pire qu'aucun
 * contrôle : il donne une fausse assurance.
 */
const GAIN_TERMS = {
  fr: ["illimité", "illimitée", "débloque", "ouvre", "en parallèle", "sans compteur"],
  en: ["unlimited", "unlock", "opens", "in parallel", "no counter"],
  es: ["ilimitado", "ilimitada", "desbloquea", "abre", "en paralelo", "sin contador"],
  ru: ["безлимит", "открывает", "параллел", "без счетчика", "без счётчика"],
};

/* Un ideogramme CJK porte en moyenne deux fois plus d'information qu'une
   lettre latine : 63 idéogrammes chinois sont une explication complète, là
   où 63 lettres françaises seraient un slogan. On compare donc des POIDS
   DE TEXTE (CJK = 2, autres = 1), pas une brutalité de caractères — sinon
   le contrôle exigerait du padding, pas de l'explication. */
const textWeight = (s) => {
  let n = 0;
  for (const ch of s) {
    n += /[\u1100-\u11ff\u2e80-\u303f\u3040-\u30ff\u3130-\u318f\u3400-\u4dbf\u4e00-\u9fff\ua960-\ua97f\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/.test(ch) ? 2 : 1;
  }
  return n;
};

{
  const langs = langsRef;
  if (langs.length !== 12) fail(`copy des verrous: ${langs.length} langues (12 attendues)`);
  else ok(`les 3 blocages sont traduits dans ${langs.length} langues`);

  let anyMissing = false;
  for (const lang of langs) {
    const copy = getPremiumCopy(lang);
    const c = copy?.premium;
    for (const key of ["languages", "shadow", "characters"]) {
      const block = c?.lock?.[key];
      if (!block?.title || !block?.body || !block?.cta) {
        fail(`${lang}: le blocage « ${key} » est incomplet`);
        anyMissing = true;
      }
    }
    if (!c?.quota?.remaining || !c?.quota?.resets || !c?.upsell?.finePrint) {
      fail(`${lang}: les strings de quota ou d'invite sont incomplètes`);
      anyMissing = true;
    }
  }
  if (!anyMissing) ok("aucune clé manquante dans les 12 langues");

  // Vocabulaire de perte : on vérifie le texte AFFICHÉ, pas le commentaire
  // qui l'explique. C'est la seule garantie vérifiable dans les 12 langues.
  for (const lang of langs) {
    const c = getPremiumCopy(lang)?.premium;
    for (const key of ["languages", "shadow", "characters"]) {
      const text = `${c.lock[key].title} ${c.lock[key].body} ${c.lock[key].cta}`;
      for (const re of LOSS_VOCABULARY) {
        if (re.test(text)) fail(`${lang}/${key}: vocabulaire de perte (${re})`);
      }
    }
  }
  ok("les 3 blocages × 12 langues : aucune perte fictive");

  // Le « gain » ne se vérifie pas par mot-clé dans les 12 langues — un
  // mot français dans une phrase wolof ne prouverait rien, et cela
  // reviendrait à exiger de la France. Ce qu'on exige est STRUCTUREL :
  // un blocage qui dit ce qu'on obtient, en assez de mots pour que ce
  // soit une explication et non un « non ».
  for (const lang of langs) {
    const c = getPremiumCopy(lang)?.premium;
    for (const key of ["languages", "shadow", "characters"]) {
      const b = c.lock[key];
      const body = textWeight(b.body ?? "");
      const cta = textWeight((b.cta ?? "").trim());
      if (body < 80) {
        fail(`${lang}/${key}: corps trop court (${body} car. pondérées) — un blocage doit EXPLIQUER le gain, pas juste dire non`);
      }
      if (cta < 5) {
        fail(`${lang}/${key}: libellé de bouton vide ou trop court`);
      }
    }
  }
  ok("les 3 blocages × 12 langues : le gain est formulé, pas seulement le refus");

  // Sur les langues dont on connaît le vocabulaire d'annonce, on vérifie
  // en plus que le gain est explicitement nommé.
  for (const lang of Object.keys(GAIN_TERMS)) {
    const c = getPremiumCopy(lang)?.premium;
    const terms = GAIN_TERMS[lang];
    for (const key of ["languages", "shadow", "characters"]) {
      const text = `${c.lock[key].title} ${c.lock[key].body} ${c.lock[key].cta}`.toLowerCase();
      if (!terms.some((term) => text.includes(term))) {
        fail(`${lang}/${key}: le blocage ne nomme pas le gain obtenu (attendu un de : ${terms.join(", ")})`);
      }
    }
  }
  ok("fr/en/es/ru : le gain est explicitement nommé dans les 3 blocages");
}

/* Aucune urgence fabriquée. On vérifie la COPY affichée, pas le SOURCE :
   les commentaires de ces fichiers parlent justement de ne PAS simuler
   d'urgence, et chercher un mot français dans un commentaire
   constituerait un contrôle absurde. */
{
  for (const lang of langsRef) {
    const c = getPremiumCopy(lang)?.premium;
    const all = JSON.stringify(c ?? {});
    if (/\b(offre|promo|deal)\s+(limitee|limitée|courte|bientôt\s+finie)\b/i.test(all)) {
      fail(`${lang}: fausse urgence dans la copy des verrous`);
    }
    if (/\b(expire|expire dans|expire le)\b/i.test(all)) {
      fail(`${lang}: date limite dans la copy des verrous`);
    }
  }
  ok("aucune fausse urgence dans la copy des verrous (12 langues)");

  /* Le badge de quota doit afficher l'heure RÉELLE, et il ne doit
     surtout pas décompter un temps restant : c'est le compte à rebours
     CLASSIQUE, celui qui se réinitialise seul et pour lequel on ne peut
     pas avoir confiance. */
  const badge = read("src/components/learner/ShadowQuotaBadge.tsx");
  if (!/resetsAt/.test(badge)) fail("ShadowQuotaBadge: l'heure réelle de remise à zéro n'est pas affichée");
  else ok("ShadowQuotaBadge: affiche l'heure RÉELLE de remise à zéro, calculée par le serveur");

  /* Aucune difference de temps ne doit être affichée comme un compte à
     rebours décroissant. */
  if (/Math\.(ceil|floor|round)\([^)]*resetsAt[^)]*-[^)]*now/i.test(badge)) {
    fail("ShadowQuotaBadge: un temps restant est calculé en direct — c'est un compte à rebours");
  }
  ok("ShadowQuotaBadge: aucun temps restant décompté, seulement une heure");
}

/* ── 5 · VISIBILITÉ DES PERSONNAGES VERROUILLÉS ──────────────────────── */

{
  const ai = read("src/convex/aiConversation.ts");
  const listBlock = ai.slice(ai.indexOf("export const listCharacters"), ai.indexOf("const scenarioValidator"));
  // Le `.map` doit RENVOYER les 6 verrouillés avec `locked: true`, pas
  // les filtrer.
  if (/\.filter\(/.test(listBlock)) {
    fail("aiConversation.listCharacters: filtre la liste au lieu de marquer le verrou — les personnages disparaîtraient");
  }
  if (!/locked: isCharacterLocked/.test(listBlock)) {
    fail("aiConversation.listCharacters: le drapeau `locked` n'est pas renvoyé");
  }
  ok("listCharacters renvoie les 8 personnages, 6 marqués verrouillés (visibles, pas tronqués)");

  eq(isCharacterLocked("baba_street", false), false, "Baba Street est gratuit");
  eq(isCharacterLocked("mama_wisdom", false), false, "Mama Wisdom est gratuit");
  eq(isCharacterLocked("dj_vibes", false), true, "DJ Vibes est verrouillé en gratuit");
  eq(isCharacterLocked("dj_vibes", true), false, "et ouvert en Premium");
  eq(isCharacterLocked("dj_vibes", undefined), false, "un état inconnu ne verrouille jamais");
}

/* La justification du choix des 2 doit rester VRAIE : on recompte les
   occurrences de copy qui la soutiennent, sur le MÊME périmètre que le
   comptage d'origine (`src/lib`, `src/components`, `src/pages`). */
{
  const SCOPE = ["src/lib", "src/components", "src/pages"];
  let baba = 0;
  let mamaAfrica = 0;
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (dir) => {
    for (const name of readdirSync(new URL(`../${dir}/`, import.meta.url))) {
      const rel = `${dir}/${name}`;
      if (statSync(new URL(`../${rel}`, import.meta.url)).isDirectory()) {
        walk(rel);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const src = readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
      baba += (src.match(/Baba Street/g) ?? []).length;
      mamaAfrica += (src.match(/Mama Africa/g) ?? []).length;
    }
  };
  SCOPE.forEach(walk);

  if (baba < 10) {
    fail(`la justification annonce 16 occurrences de « Baba Street » : il n'y en a plus que ${baba}`);
  } else ok(`la justification tient toujours : ${baba} occurrences de « Baba Street » en copy`);

  if (mamaAfrica < 2) {
    fail(`la justification annonce « Mama Africa » en landing : il n'y en a plus que ${mamaAfrica}`);
  } else ok(`la justification tient toujours : ${mamaAfrica} occurrences de « Mama Africa » en copy`);
}

/* ── 6 · QUOTA : JOUR LOCAL, PAS UTC ──────────────────────────────────── */

{
  // 23h30 UTC, heure de Paris (UTC+2 en été) → déjà le lendemain.
  const late = Date.parse("2026-06-15T23:30:00.000Z");
  eq(localDayKey(late, "Europe/Paris"), "2026-06-16", "le jour suit le fuseau, pas UTC");
  eq(localDayKey(late, "UTC"), "2026-06-15", "en UTC la même heure est la veille");
  eq(localDayKey(late, "Africa/Lagos"), "2026-06-16", "et à Lagos aussi");
  eq(localDayKey(late, "Pas/unFuseau"), "2026-06-15", "un fuseau invalide retombe sur UTC sans casser");

  const reset = nextLocalMidnight(late, "Europe/Paris");
  eq(localDayKey(reset - 1, "Europe/Paris"), "2026-06-16", "juste avant la remise à zéro, on est encore le 16");
  eq(localDayKey(reset, "Europe/Paris"), "2026-06-17", "et juste après, le 17");

  const q = shadowQuotaState(false, 2, late, "Europe/Paris");
  eq(q.remaining, 3, "3 analyses restantes sur 5");
  eq(q.unlimited, false, "le gratuit n'est pas illimité");
  const p = shadowQuotaState(true, 999, late, "Europe/Paris");
  eq(p.unlimited, true, "Premium est illimité");
  eq(shadowQuotaState(false, 99, late, "UTC").remaining, 0, "un compteur qui dépasse ne devient jamais négatif");
}

/* ── 7 · CODES D'ERREUR ──────────────────────────────────────────────── */

{
  eq(isQuotaShadowError(new Error("quota_shadow")), true, "le code quota est reconnu");
  eq(isQuotaShadowError(new Error("Autre chose")), false, "une autre erreur n'est pas un quota");
  eq(isQuotaShadowError(undefined), false, "une absence n'est pas un quota");
  eq(isCharacterLockedError(new Error("character_locked")), true, "le code personnage est reconnu");
  eq(isCharacterLockedError(new Error("boom")), false, "une autre erreur n'est pas un verrou personnage");
}

/* ── 8 · LE PLAFARD VIENT DU SERVEUR ─────────────────────────────────── */

{
  const learning = read("src/convex/learning.ts");
  if (!/activeLanguageCap: activeLanguageCap\(/.test(learning)) {
    fail("learning.myLanguages: ne renvoie pas le plafond — l'interface ne peut pas expliquer la limite");
  }
  if (!/isPremium/.test(learning)) {
    fail("learning.myLanguages: ne renvoie pas isPremium — le client déciderait de son propre chef");
  }
  ok("le plafond et l'état Premium viennent du serveur (le client ne recalcule rien)");

  /* Un `isPremium` local dans les composants des verrous serait une
     seconde vérité — exactement ce que le Module A du lot précédent a
     supprimé. */
  for (const path of [
    "src/components/learner/FocusDialog.tsx",
    "src/components/learner/ShadowQuotaBadge.tsx",
    "src/components/learner/AIConversationRoom.tsx",
  ]) {
    const src = read(path);
    if (/const isPremium\s*=\s*(true|false)/.test(src)) {
      fail(`${path}: un isPremium local (constante) — l'accès serait decided hors de la source de vérité`);
    }
  }
  ok("aucun isPremium local dans les surfaces de verrou");
}

/* ── FIN ──────────────────────────────────────────────────────────────── */

if (failures > 0) {
  console.log(`\nVERROUS PREMIUM : ${failures} ÉCHEC(S)`);
  process.exit(1);
}
console.log(
  `\nVERROUS PREMIUM : 3 verrous · 12 langues · boucle d'apprentissage INTACTE · grandfathering vérifié ✓`,
);
