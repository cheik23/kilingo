/* ═══════════════════════════════════════════════════════════════════════
   L'EXPORT CSV / ANKI — COPY DES 12 LANGUES (overlay)

   Les six dictionnaires historiques (fr / en / es / zh / ar / ru) portent
   déjà `exportMenu.*` — mais SANS la clé `instructionsAnki`, ajoutée avec
   ce lot. Les six autres — sw, ln, ha, yo, zu, wo — tombaient entièrement
   sur le repli français : un utilisateur swahili voyait « Exporter » et
   « Toutes les langues » en français dans un menu situé sous son header.

   Cet overlay couvre donc les 12 langues, et fournit `instructionsAnki`
   partout. Contrat : `getExportCopy(lang)` renvoie `{ exportMenu: {…} }`
   ou `undefined`, fusionné par-dessus les dictionnaires de base (voir
   i18n.tsx → applyDictionaryOverlays).

   Clés consommées par components/learner/MemoryView.tsx — aucune invention.
   ═══════════════════════════════════════════════════════════════════════ */

type ExportCopy = {
  /** Libellé du bouton dans le header de Ma mémoire. */
  label: string;
  csv: string;
  tsv: string;
  /** Titre du sélecteur de langue dans le menu déroulant. */
  language: string;
  allLangs: string;
  /** Tooltip affiché quand le bouton est désactivé (deck vide). */
  emptyHint: string;
  /** Toast de succès — `{n}` est remplacé par le nombre de cartes. */
  done: string;
  failed: string;
  /** Aide pas-à-pas pour l'import dans Anki (le réglage n'est pas devinable). */
  instructionsAnki: string;
};

const EXPORT: Record<string, ExportCopy> = {
  fr: {
    label: "Exporter",
    csv: "CSV (Excel)",
    tsv: "TSV (Anki)",
    language: "Langue",
    allLangs: "Toutes les langues",
    emptyHint: "Ajoute d'abord des cartes",
    done: "{n} cartes exportées",
    failed: "Export impossible",
    instructionsAnki: "Dans Anki : Fichier → Importer → choisir le .tsv",
  },
  en: {
    label: "Export",
    csv: "CSV (Excel)",
    tsv: "TSV (Anki)",
    language: "Language",
    allLangs: "All languages",
    emptyHint: "Add some cards first",
    done: "{n} cards exported",
    failed: "Export failed",
    instructionsAnki: "In Anki: File → Import → pick the .tsv file",
  },
  es: {
    label: "Exportar",
    csv: "CSV (Excel)",
    tsv: "TSV (Anki)",
    language: "Idioma",
    allLangs: "Todos los idiomas",
    emptyHint: "Añade primero tarjetas",
    done: "{n} tarjetas exportadas",
    failed: "No se pudo exportar",
    instructionsAnki: "En Anki: Archivo → Importar → elige el archivo .tsv",
  },
  zh: {
    label: "导出",
    csv: "CSV（Excel）",
    tsv: "TSV（Anki）",
    language: "语言",
    allLangs: "所有语言",
    emptyHint: "请先添加卡片",
    done: "已导出 {n} 张卡片",
    failed: "导出失败",
    instructionsAnki: "在 Anki 中：文件 → 导入 → 选择 .tsv 文件",
  },
  ar: {
    label: "تصدير",
    csv: "CSV (Excel)",
    tsv: "TSV (Anki)",
    language: "اللغة",
    allLangs: "كل اللغات",
    emptyHint: "أضف بطاقات أولاً",
    done: "تم تصدير {n} بطاقة",
    failed: "فشل التصدير",
    instructionsAnki: "في Anki: ملف ← استيراد ← اختر ملف .tsv",
  },
  ru: {
    label: "Экспорт",
    csv: "CSV (Excel)",
    tsv: "TSV (Anki)",
    language: "Язык",
    allLangs: "Все языки",
    emptyHint: "Сначала добавьте карточки",
    done: "Экспортировано карточек: {n}",
    failed: "Не удалось экспортировать",
    instructionsAnki: "В Anki: Файл → Импорт → выбери файл .tsv",
  },
  sw: {
    label: "Hamisha",
    csv: "CSV (Excel)",
    tsv: "TSV (Anki)",
    language: "Lugha",
    allLangs: "Lugha zote",
    emptyHint: "Ongeza kadi kwanza",
    done: "Kadi {n} zilizohamishwa",
    failed: "Hamisho limeshindikana",
    instructionsAnki: "Katika Anki: Faili → Ingiza → chagua faili la .tsv",
  },
  ln: {
    label: "Kota",
    csv: "CSV (Excel)",
    tsv: "TSV (Anki)",
    language: "Lokótá",
    allLangs: "Mikótá mizónso",
    emptyHint: "Bóngá mboká oyo ekotambolá",
    done: "Mikárá {n} ekotámbola",
    failed: "Ekotámbola ekoponekí",
    instructionsAnki: "Na Anki: File → Import → selecte fichier .tsv",
  },
  ha: {
    label: "Zazzabawa",
    csv: "CSV (Excel)",
    tsv: "TSV (Anki)",
    language: "Harshe",
    allLangs: "Dukkan harshen",
    emptyHint: "Ƙara kati da farko",
    done: "An zaɗa kati {n}",
    failed: "Zazzabawa bai yi nasara",
    instructionsAnki: "A cikin Anki: File → Import → zaɓi fayil ɗin .tsv",
  },
  yo: {
    label: "Pín",
    csv: "CSV (Excel)",
    tsv: "TSV (Anki)",
    language: "Èdè",
    allLangs: "Gbogbo èdè",
    emptyHint: "Fi káàrà kì í ṣe",
    done: "Káàrà {n} ti jáde",
    failed: "Pín kò sọ́",
    instructionsAnki: "Ní Anki: File → Import → yàn fi .tsv",
  },
  zu: {
    label: "Yabelana",
    csv: "CSV (Excel)",
    tsv: "TSV (Anki)",
    language: "Ulimi",
    allLangs: "Zonke ulimi",
    emptyHint: "Faka amakhadi kuqala",
    done: "Amakhadi {n} asabelanwe",
    failed: "Ukushabelana akuphumele",
    instructionsAnki: "Ku-Anki: Isfayela → Ngenisa → khetha ifayela .tsv",
  },
  wo: {
    label: "Raan",
    csv: "CSV (Excel)",
    tsv: "TSV (Anki)",
    language: "Làkk",
    allLangs: "Làkk yi nu gén",
    emptyHint: "Dugg kàrdey di làm bi",
    done: "Kàrdey {n} di raane",
    failed: "Raan bu dugg bu nekk",
    instructionsAnki: "Ci Anki: File → Import → escolher fichier .tsv",
  },
};

export function getExportCopy(lang: string): unknown | undefined {
  const exportMenu = EXPORT[lang];
  if (!exportMenu) return undefined;
  return { exportMenu };
}
