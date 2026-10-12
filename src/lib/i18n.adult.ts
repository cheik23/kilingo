/* ═══════════════════════════════════════════════════════════════════════
   AVERTISSEMENT « CONTENU ADULTE » — COPY DES 6 LANGUES HISTORIQUES (overlay)

   Deux chaînes : l'étiquette du badge et l'infobulle qui l'explique. Écrit
   sur le modèle exact de `i18n.validation.ts`, y compris ses deux règles de
   rédaction :

   · Le badge INFORME, il ne censure pas. Une fiche marquée `isAdult` reste
     une fiche d'argot réelle, enseignée comme les autres : elle apparaît
     dans la découverte, le quiz et la révision. L'infobulle le dit
     explicitement, parce qu'un avertissement sans cette précision se lit
     comme une interdiction.

   · Il ne prend pas la place de l'expression. Il se pose À CÔTÉ, comme le
     badge « non vérifié », et ne masque jamais le mot.

   COUVERTURE VOLONTAIREMENT PARTIELLE

   fr, en, es, zh, ar, ru sont fournies ; les six autres dictionnaires d'UI
   (sw, ln, ha, yo, zu, wo) n'en ont PAS et `t()` retombe alors sur le
   français — c'est le précédent posé par `i18n.validation.ts` et
   `i18n.signs.ts`, et il vaut mieux un repli français assumé qu'une
   traduction non relue sur un sujet sensible.

   Contrat : `getAdultCopy(lang)` renvoie `{ adult: {…} }` ou `undefined`,
   fusionné par-dessus les dictionnaires de base (voir i18n.tsx →
   applyDictionaryOverlays).
   ═══════════════════════════════════════════════════════════════════════ */

type AdultCopy = {
  /** Étiquette du badge, à côté de l'icône. */
  label: string;
  /** Infobulle : ce que le marquage veut dire, et ce qu'il ne bloque pas. */
  tooltip: string;
};

const ADULT: Record<string, AdultCopy> = {
  fr: {
    label: "Contenu adulte",
    tooltip:
      "Cette expression vient du registre sexuel ou très cru. Elle reste utilisable : les exercices, la révision et la prononciation fonctionnent normalement. À réserver à un usage averti.",
  },
  en: {
    label: "Adult content",
    tooltip:
      "This expression comes from the sexual or very crude register. It is still usable: exercises, revision and pronunciation all work normally. Recommended for warned users only.",
  },
  es: {
    label: "Contenido adulto",
    tooltip:
      "Esta expresión pertenece al registro sexual o muy soez. Sigue siendo utilizable: los ejercicios, el repaso y la pronunciación funcionan con normalidad. Recomendada solo para usuarios advertidos.",
  },
  zh: {
    label: "成人内容",
    tooltip:
      "该表达属于性相关或极粗俗的语域。仍可正常使用：练习、复习和发音功能不受影响，建议仅在已知情的情况下使用。",
  },
  ar: {
    label: "محتوى للبالغين",
    tooltip:
      "هذا التعبير ينتمي إلى المستوى الجنسي أو الفاحش جدًا. ما زال قابلاً للاستخدام: التمارين والمراجعة والنطق تعمل بشكل طبيعي، ويُستخدم بحذر ومع علم مسبق.",
  },
  ru: {
    label: "Контент 18+",
    tooltip:
      "Выражение относится к сексуальному или грубому регистру. Им по-прежнему можно пользоваться: упражнения, повторение и произношение работают как обычно. Рекомендуется для предупреждённых пользователей.",
  },
};

export function getAdultCopy(lang: string): unknown | undefined {
  const adult = ADULT[lang];
  if (!adult) return undefined;
  return { adult };
}
