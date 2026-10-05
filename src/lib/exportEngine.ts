/**
 * EXPORT CSV / ANKI — 100 % client.
 *
 * Aucune requête réseau, aucun connecteur, aucun appel serveur : les cartes
 * arrivent déjà en mémoire depuis la query Convex du deck, et le fichier est
 * fabriqué puis téléchargé dans le navigateur. Rien ne quitte l'appareil.
 */

/** Une ligne exportable. `mastery` est le statut SRS (learning/confirming/mastered). */
export type ExportCard = {
  expression: string;
  language: string;
  meaning: string;
  example: string;
  translation: string;
  mastery?: string;
};

/* ═══════════════════════════════════════════════════════════════════
   ÉCHAPPEMENT
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Champ CSV : toujours entre guillemets, avec `"` interne doublé.
 *
 * On surround TOUJOURS, même sans caractère spécial : c'est la forme la plus
 * robuste (pas de cas limite) et la plus lisible pour Excel, qui sinon
 * interprete `=`, `+`, `-`, `@` en tête de cellule comme une formule.
 */
function csvField(value: string): string {
  const safe = (value ?? "").replace(/\r\n|\r|\n/g, "\n");
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Nettoyage TSV : un tabulateur ou un saut de ligne DANS un champ casse
 * l'alignement des colonnes pour Anki. On les aplatit en espaces.
 */
function tsvField(value: string): string {
  return (value ?? "").replace(/[\t\n\r]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

/* ═══════════════════════════════════════════════════════════════════
   NOMS DE FICHIERS
   ═══════════════════════════════════════════════════════════════════ */

/** Horodatage local YYYY-MM-DD (pas UTC : l'export se fait « aujourd'hui »). */
function todayStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `kilingo-{lang}-{YYYY-MM-DD}` — format de nommage de l'export. */
export function exportFilename(
  language: string,
  extension: "csv" | "tsv",
  date = new Date(),
): string {
  const tag = !language || language === "all" ? "all" : language;
  return `kilingo-${tag}-${todayStamp(date)}.${extension}`;
}

/* ═══════════════════════════════════════════════════════════════════
   SÉRIALISATION
   ═══════════════════════════════════════════════════════════════════ */

/**
 * CSV — colonnes `expression,language,meaning,example,translation,mastery`.
 *
 * Le BOM U+FEFF en tête est ce qui fait qu'Excel affiche « é » correctement
 * au lieu de « Ã© ». Sans lui, Excel applique le codage local (cp1252) et
 * massacre tous les accents — c'est LE point critique de ce format.
 */
export function buildCSV(cards: ExportCard[]): string {
  const head = "expression,language,meaning,example,translation,mastery";
  const body = cards
    .map((card) =>
      [
        card.expression,
        card.language,
        card.meaning,
        card.example,
        card.translation,
        card.mastery ?? "",
      ]
        .map(csvField)
        .join(","),
    )
    .join("\n");
  return `\uFEFF${head}\n${body}\n`;
}

/**
 * Anki TSV — 2 colonnes : `front` puis `back`.
 *
 * Front : l'expression, suffixe `[LANG]` pour ne pas confondre deux cartes
 * identiques apprises dans deux langues.
 * Back  : sens, exemple et traduction séparés par des sauts de ligne, que
 *         Anki rend comme des lignes distinctes. Les sauts DANS un champ
 *         sont, eux, aplatis (voir `tsvField`) pour ne pas casser l'alignement.
 */
export function buildAnkiTsv(cards: ExportCard[]): string {
  const body = cards
    .map((card) => {
      const front = `${tsvField(card.expression)} [${tsvField(card.language).toUpperCase()}]`;
      const back = [
        tsvField(card.meaning),
        tsvField(card.example),
        tsvField(card.translation),
      ]
        .filter((part) => part.length > 0)
        .join("\n");
      return `${front}\t${back}`;
    })
    .join("\n");
  return `${body}\n`;
}

/* ═══════════════════════════════════════════════════════════════════
   TÉLÉCHARGEMENT
   ═══════════════════════════════════════════════════════════════════ */

const CSV_MIME = "text/csv;charset=utf-8";
const TSV_MIME = "text/tab-separated-values;charset=utf-8";

/**
 * Blob + objectURL + clic programmatique.
 *
 * `revokeObjectURL` est appelé après le clic : l'URL doit survivre le temps
 * que le navigateur déclenche le téléchargement. On diffère d'un tick sinon
 * Firefox annule le download sur les gros fichiers.
 */
function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Fabrique et télécharge le CSV. Renvoie le nom du fichier écrit. */
export function exportCSV(cards: ExportCard[], language: string): string {
  const filename = exportFilename(language, "csv");
  downloadBlob(buildCSV(cards), filename, CSV_MIME);
  return filename;
}

/** Fabrique et télécharge le TSV Anki. Renvoie le nom du fichier écrit. */
export function exportAnki(cards: ExportCard[], language: string): string {
  const filename = exportFilename(language, "tsv");
  downloadBlob(buildAnkiTsv(cards), filename, TSV_MIME);
  return filename;
}
