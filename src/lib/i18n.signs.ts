/* ═══════════════════════════════════════════════════════════════════════
   LANGUE DES SIGNES (LSF) — COPY (overlay)

   Module entier absent des 12 dictionnaires de base, donc overlay comme
   `i18n.avatar.ts` et `i18n.pwa.ts`. Français et anglais sont complets ;
   les dix autres langues retombent sur le français via le repli de `t()`,
   exactement comme la landing v2. Aucun signale n'est inventé : les
   mots affichés dans les fiches viennent des clips, pas d'ici.

   Trois choses ne sont pas de la traduction mais de l'honnêteté, et
   elles sont écrites dans la copy plutôt que dans un commentaire :

     · la LSF n'est ni l'ASL ni une langue des signes africaine ;
     · un signeur n'est pas « la » LSF — il y a des variantes régionales ;
     · les mots affichés viennent de noms de fichiers Commons, ils sont
       donc « à valider » et chaque fiche offre un signalement.

   Contrat : `getSignsCopy(lang)` renvoie `{ signs: {…} }` ou `undefined`,
   fusionné par-dessus les dictionnaires de base (i18n.tsx →
   applyDictionaryOverlays).
   ═══════════════════════════════════════════════════════════════════════ */

type SignsCopy = {
  title: string;
  subtitle: string;
  /** Bandeau d'honnêteté, en tête de section. */
  honestTitle: string;
  honestBody: string;
  honestVariant: string;
  search: string;
  themeAll: string;
  /** Fiche : mention « gloss à valider ». */
  toValidate: string;
  repeat: string;
  slow: string;
  by: string;
  license: string;
  source: string;
  report: string;
  reported: string;
  reportTitle: string;
  reportBody: string;
  reportReasons: { wrongWord: string; duplicate: string; wrongSign: string; other: string };
  reportNote: string;
  reportSend: string;
  reportCancel: string;
  reportDone: string;
  credits: string;
  creditsTitle: string;
  creditsIntro: string;
  creditsCounts: string;
  creditsSigners: string;
  creditsHosting: string;
  /** Phrase explicite : Kilingo ne stocke aucun de ces fichiers. */
  creditsHostingLine: string;
  creditsReports: string;
  quiz: string;
  quizTitle: string;
  quizBody: string;
  quizQuestion: string;
  quizRight: string;
  quizWrong: string;
  quizNext: string;
  quizEmpty: string;
  seen: string;
  notStarted: string;
};

const SIGNS: Record<string, SignsCopy> = {
  fr: {
    title: "Langue des signes (LSF)",
    subtitle:
      "Des signes filmés, pas dessinés : chaque clip vient d'une personne qui signe, sous licence libre.",
    honestTitle: "Ce que cette section est — et ce qu'elle n'est pas",
    honestBody:
      "LSF, langue des signes française. Ce n'est pas l'ASL (la langue des signes américaine) ni une langue des signes africaine : les signes ne se transposent pas d'une langue à l'autre. Cette section ne propose que de la LSF, et n'en promet aucune autre.",
    honestVariant:
      "Les clips viennent de quelques signeurs seulement. La LSF a des variantes régionales : un signeur n'est pas « la » LSF, et l'enregistrement d'un signeur n'est pas une norme.",
    search: "Chercher un signe",
    themeAll: "Tous les signes",
    toValidate: "Mot à valider",
    repeat: "Rejouer le signe",
    slow: "Lent",
    by: "par",
    license: "Licence",
    source: "Voir la fiche source",
    report: "Signaler une erreur",
    reported: "Signalé",
    reportTitle: "Signaler une erreur sur ce signe",
    reportBody:
      "Les mots affichés proviennent du nom du fichier sur Wikimedia Commons : ils peuvent être fautifs, dupliqués ou mal orthographiés. Ton signalement sert à corriger la fiche.",
    reportReasons: {
      wrongWord: "Le mot est erroné",
      duplicate: "Doublon",
      wrongSign: "Le signe ne correspond pas",
      other: "Autre",
    },
    reportNote: "Précision (facultatif)",
    reportSend: "Envoyer le signalement",
    reportCancel: "Annuler",
    reportDone: "Signalement envoyé — merci.",
    credits: "Crédits et licences",
    creditsTitle: "Crédits et licences",
    creditsIntro:
      "Chaque clip affiché ici est un fichier de Wikimedia Commons, avec la licence lue dans les métadonnées de ce fichier — jamais supposée. Rien n'est hébergé par Kilingo.",
    creditsCounts: "Répartition par licence",
    creditsSigners: "Signeurs et sources",
    creditsHosting: "Hébergement des vidéos",
    creditsHostingLine:
      "Kilingo n'héberge aucun de ces fichiers. Chaque vidéo est diffusée par upload.wikimedia.org, à l'adresse exacte de son fichier Commons : si Wikimedia la retire, le lien de la fiche devient le lieu de la vérité.",
    creditsReports: "Signalements ouverts",
    quiz: "Quiz des signes",
    quizTitle: "Devine le mot",
    quizBody:
      "Un signe s'affiche, quatre mots au choix. Huit XP par bonne réponse, dans la gamification existante.",
    quizQuestion: "Quel mot est ce signe ?",
    quizRight: "Exact !",
    quizWrong: "Raté — c'était",
    quizNext: "Signe suivant",
    quizEmpty: "Pas assez de signes pour un quiz avec ce filtre.",
    seen: "Vu",
    notStarted: "Aucun signe vu pour l'instant.",
  },
  en: {
    title: "Sign language (LSF)",
    subtitle:
      "Filmed signs, not drawn ones: every clip is a real person signing, under a free licence.",
    honestTitle: "What this section is — and is not",
    honestBody:
      "LSF, French Sign Language. It is not ASL (American Sign Language) nor an African sign language: signs do not transfer from one language to another. This section offers LSF only, and promises no other sign language.",
    honestVariant:
      "The clips come from a handful of signers. LSF has regional variants: one signer is not \"the\" LSF, and a signer's recording is not a standard.",
    search: "Search a sign",
    themeAll: "All signs",
    toValidate: "Word to verify",
    repeat: "Replay the sign",
    slow: "Slow",
    by: "by",
    license: "Licence",
    source: "Open the source file page",
    report: "Report a mistake",
    reported: "Reported",
    reportTitle: "Report a mistake on this sign",
    reportBody:
      "The words shown come from the file name on Wikimedia Commons: they can be wrong, duplicated or misspelled. Your report helps correct the entry.",
    reportReasons: {
      wrongWord: "Wrong word",
      duplicate: "Duplicate",
      wrongSign: "The sign does not match",
      other: "Other",
    },
    reportNote: "Details (optional)",
    reportSend: "Send the report",
    reportCancel: "Cancel",
    reportDone: "Report sent — thank you.",
    credits: "Credits and licences",
    creditsTitle: "Credits and licences",
    creditsIntro:
      "Every clip shown here is a Wikimedia Commons file, with the licence read from that file's own metadata — never assumed. Kilingo hosts none of them.",
    creditsCounts: "Breakdown by licence",
    creditsSigners: "Signers and sources",
    creditsHosting: "Video hosting",
    creditsHostingLine:
      "Kilingo hosts none of these files. Every video is streamed from upload.wikimedia.org, at the exact address of its Commons file: if Wikimedia removes it, the link on the sign sheet becomes the source of truth.",
    creditsReports: "Open reports",
    quiz: "Sign quiz",
    quizTitle: "Guess the word",
    quizBody:
      "One sign is shown, four words to choose from. Eight XP per correct answer, in the existing gamification.",
    quizQuestion: "Which word is this sign?",
    quizRight: "Correct!",
    quizWrong: "Not quite — it was",
    quizNext: "Next sign",
    quizEmpty: "Not enough signs for a quiz with this filter.",
    seen: "Seen",
    notStarted: "No sign seen yet.",
  },
};

export function getSignsCopy(lang: string): unknown | undefined {
  const s = SIGNS[lang];
  if (!s) return undefined;
  return { signs: s };
}
