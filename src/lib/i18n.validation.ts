/* ═══════════════════════════════════════════════════════════════════════
   CONTENU EN ATTENTE DE VALIDATION — COPY DES 6 LANGUES HISTORIQUES (overlay)

   Deux chaînes seulement : l'étiquette du badge et l'infobulle qui
   l'explique.

   LA RÈGLE DE RÉDACTION, ET POURQUOI ELLE EST ÉCRITE ICI

   · Le badge INFORME, il ne dévalue pas. « Non vérifié » dit l'état du
     contenu, pas la qualité de la langue : ces fiches amhariques et igbo
     sont une base de travail solide, simplement pas encore relue par un
     natif. Un libellé du genre « contenu douteux » ferait douter de tout le
     lot, et d'une langue entière par la même occasion.

   · Il ne bloque RIEN. L'infobulle précise que l'expression reste
     utilisable et que les exercices fonctionnent : priver l'apprenant d'un
     mot parce qu'un relecteur manque serait un aveu, pas une protection.

   · Il DIT QUI doit agir. « En attente de relecture par un locuteur natif »
     désigne la prochaine étape ; « bientôt vérifié » n'engagerait personne.

   COUVERTURE VOLONTAIREMENT PARTIELLE

   fr, en, es, zh, ar, ru sont fournies. Les six autres dictionnaires d'UI
   (sw, ln, ha, yo, zu, wo) n'en ont PAS : `t()` retombe alors sur le
   français (`resolve(DICTS[lang], key) ?? resolve(fr, key)` dans i18n.tsx).
   C'est délibéré et c'est le précédent posé par `i18n.signs.ts` : une
   traduction non vérifiée en lingala ou en wolof serait un faux-semblant
   dans un produit qui parle justement de locuteurs natifs. À faire écrire
   par des natifs, comme le contenu du Lot 4 lui-même.

   Contrat : `getValidationCopy(lang)` renvoie `{ validation: {…} }` ou
   `undefined`, fusionné par-dessus les dictionnaires de base (voir
   i18n.tsx → applyDictionaryOverlays).
   ═══════════════════════════════════════════════════════════════════════ */

type ValidationCopy = {
  /** Étiquette du badge, à côté de l'icône ⚠️. */
  unverified: string;
  /** Infobulle : ce que « non vérifié » veut dire, et ce que ça ne bloque pas. */
  tooltip: string;
};

const VALIDATION: Record<string, ValidationCopy> = {
  fr: {
    unverified: "Non vérifié",
    tooltip:
      "Expression en attente de relecture par un locuteur natif. Elle reste utilisable : les exercices, la révision et la prononciation fonctionnent normalement. Seuls le sens ou le registre peuvent encore être ajustés.",
  },
  en: {
    unverified: "Unverified",
    tooltip:
      "This expression is awaiting review by a native speaker. It is still usable: exercises, revision and pronunciation all work normally. Only the meaning or the register may still be adjusted.",
  },
  es: {
    unverified: "Sin verificar",
    tooltip:
      "Expresión pendiente de revisión por un hablante nativo. Sigue siendo utilizable: los ejercicios, el repaso y la pronunciación funcionan con normalidad. Solo el sentido o el registro pueden ajustarse todavía.",
  },
  zh: {
    unverified: "未核实",
    tooltip:
      "该表达尚待母语者审校。仍可正常使用：练习、复习和发音功能不受影响，仅含义或语体可能还会有调整。",
  },
  ar: {
    unverified: "غير مُدقَّق",
    tooltip:
      "هذا التعبير في انتظار مراجعة متحدّث أصلي. ما زال قابلاً للاستخدام: التمارين والمراجعة والنطق تعمل بشكل طبيعي، وقد يُعدَّل المعنى أو المستوى اللغوي فقط.",
  },
  ru: {
    unverified: "Не проверено",
    tooltip:
      "Выражение ожидает проверки носителем языка. Им по-прежнему можно пользоваться: упражнения, повторение и произношение работают как обычно. Уточняться могут только значение или регистр.",
  },
};

export function getValidationCopy(lang: string): unknown | undefined {
  const validation = VALIDATION[lang];
  if (!validation) return undefined;
  return { validation };
}
