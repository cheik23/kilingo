/* ═══════════════════════════════════════════════════════════════════════
   KILINGO — COMPARAISON LEXICALE DES EXPRESSIONS D'ARGOT

   La détection historique utilisait `haystack.includes(expression)`. Une
   expression courte comme « PE » matchait donc « peut », et « cap » matchait
   « captain ». Ce module compare désormais des MOTS, pas des sous-chaînes.

   Règles :
     - frontière lexicale exigée à gauche ; à droite, une fin de mot ou une
       flexion courante de la langue de l'expression ;
     - 1 à 3 caractères : mot entier uniquement (pluriel « s » toléré) ;
     - 4 caractères et plus : une liste FERMÉE de fins de mot fléchies est
       tolérée (« ghost » → « ghosted », « flop » → « flopped »), jamais une
       continuation arbitraire (« ratio » ne matche pas « ration ») ;
     - article défini arabe « ال » et quelques préfixes de classe nominale
       (lingala, zoulou) sont traités comme des proclitiques, pas comme des
       lettres du mot ;
     - les expressions composées gardent leurs bornes : « spin the block »
       ne matche pas « spinning the block ».

   Normalisation (des deux côtés) : casse, diacritiques latins, apostrophes
   typographiques, tirets, espaces. Les marques non latines (harakat,
   matras) sont préservées : les supprimer changerait le sens.

   Écritures sans séparateur de mots : han, kana, hangul, thaï, lao, khmer,
   birman. Sans segmentation linguistique, une frontière fiable n'existe
   pas : pour ces expressions (et pour un texte de ces écritures), on garde
   l'inclusion directe, comportement historique documenté. Une expression
   mixte « 안녕 (annyeong) » reste cherchée sous sa forme complète.
   ═══════════════════════════════════════════════════════════════════════ */

const LATIN_COMBINING_MARKS = /[\u0300-\u036f]/g;
const APOSTROPHES = /[’‘‛′`´]/g;
const DASHES = /[-‐‑‒–—―−]/g;
const TRAILING_SENTENCE_PUNCTUATION = /[?!.…,;:。？！，、；：»"”]+$/u;
const WORD_CHAR = /^[\p{L}\p{N}\p{M}_]$/u;
const SOME_WORD_CHAR = /[\p{L}\p{N}\p{M}]/u;
const CONTINUOUS_SCRIPT =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
/** Fin de mot redoublée + ed/ing : « flop » → « flopped », « plan » → « planned ». */
const DOUBLED_INFLECTION = /^(ed|ing)$/;

/**
 * Fins de mot fléchies tolérées, par langue de l'expression. Liste fermée,
 * issue des formes réellement présentes dans le catalogue et les exemples
 * du pipeline. Ce n'est pas un stemmer général : une continuation absente
 * de cette table ne matche pas.
 */
const INFLECTION_SUFFIXES: Record<string, readonly string[]> = {
  en: ["s", "es", "ed", "d", "ing"],
  fr: ["s", "es", "e", "er", "r"],
  es: ["s", "es", "os", "as", "o", "a", "ar", "ir", "ado", "ada", "ando", "iendo", "r"],
  ru: ["у", "а", "е", "и", "ы", "я", "о", "ит", "ят", "ет", "ут", "нуть", "ная", "ный", "ное", "ные", "ой", "ем", "ом", "ах", "ам", "ов", "ев"],
  ar: ["ة", "ات", "ين", "ون", "ها", "هم", "نا"],
  ha: ["n", "r", "na", "ta", "nsa"],
  wo: ["u", "al"],
  de: ["s", "e", "en", "er", "es", "t", "st", "te", "ten"],
  pt: ["s", "es", "a", "o", "as", "os", "ar", "er", "ir"],
  it: ["s", "e", "i", "a", "o", "are", "ere", "ire"],
  tr: ["lar", "ler", "sı", "si", "yı", "yi", "e", "a", "ı", "i", "lik", "lık", "in", "ın"],
  pl: ["a", "e", "y", "ie", "ów", "om", "ami"],
  id: ["s", "e", "nya", "ku", "mu", "kan", "an"],
  fa: ["ها", "های", "ی", "ام", "ات", "اش", "مان", "تان", "شان"],
  tl: ["s", "ing", "ed", "e"],
};

/**
 * Mots finaux adjectivaux : une expression composée qui s'achève sur l'un
 * d'eux n'accepte pas de flexion (« you good » ne matche pas « you gooding »).
 * Liste volontairement courte : elle couvre les faux positifs observés, pas
 * une classification grammaticale complète.
 */
const NON_INFLECTABLE_FINAL_WORDS = new Set([
  "good", "bad", "mad", "sad", "glad", "dead", "wild", "crazy", "cool",
  "fire", "hard", "soft", "sick", "ill", "lit", "dope", "fresh", "clean",
  "real", "true", "false", "free", "full", "empty", "big", "small",
  "young", "old", "new", "hot", "cold", "warm", "loud", "quiet", "rich",
  "poor", "smart", "dumb", "weird", "nice", "fine", "okay", "ok",
  "better", "best", "worse", "worst",
]);

/** Table de repli quand la langue n'est pas connue (fuseSubtitles). */
const DEFAULT_INFLECTION_SUFFIXES: readonly string[] = [
  "s",
  "es",
  "ed",
  "d",
  "ing",
  "e",
];

/**
 * Proclitiques attachés au mot, par langue. Ils ne changent pas le mot
 * lexical : « الراب » contient « راب », « Tokolia » contient « kolia ».
 */
const LANGUAGE_PREFIXES: Record<string, readonly string[]> = {
  ar: ["ال"],
  ln: ["to"],
  zu: ["u", "ngiye"],
};

/** Espagnol : e- prosthétique devant s + consonne (« espoilear »). */
const SPANISH_PROSTHETIC = /^s[bcdfghjklmnpqrstvwxyz]/;

export function normalizeForLexicalMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(LATIN_COMBINING_MARKS, "")
    .toLowerCase()
    .replace(APOSTROPHES, "'")
    .replace(DASHES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Vrai si le texte contient une écriture sans séparateur de mots. */
export function hasContinuousScript(text: string): boolean {
  return CONTINUOUS_SCRIPT.test(text);
}

function isWordChar(char: string): boolean {
  return char.length > 0 && WORD_CHAR.test(char);
}

function isContinuousChar(char: string): boolean {
  return char.length > 0 && CONTINUOUS_SCRIPT.test(char);
}

/**
 * Frontière entre deux écritures : un mot latin/digit collé à du han, du kana,
 * du hangul ou du thaï est un mot distinct (« PE鞋 », « 996工作制 »), alors
 * que deux lettres latines collées ne le sont pas (« peut »).
 */
function isBoundaryBetween(needleChar: string, hayChar: string): boolean {
  if (!hayChar || !isWordChar(hayChar)) return true;
  if (!needleChar) return true;
  return isContinuousChar(needleChar) !== isContinuousChar(hayChar);
}

/** Caractère (point de code) précédant `index`, surrogate pairs compris. */
function charBefore(text: string, index: number): string {
  if (index <= 0) return "";
  const code = text.codePointAt(index - 1);
  if (code === undefined) return "";
  if (code >= 0xdc00 && code <= 0xdfff && index >= 2) {
    const high = text.codePointAt(index - 2);
    if (high !== undefined && high >= 0xd800 && high <= 0xdbff) {
      return text.slice(index - 2, index);
    }
  }
  return String.fromCodePoint(code);
}

/** Caractère (point de code) à `index`, ou "" en fin de texte. */
function charAfter(text: string, index: number): string {
  if (index >= text.length) return "";
  const code = text.codePointAt(index);
  return code === undefined ? "" : String.fromCodePoint(code);
}

function hasLanguagePrefix(
  haystack: string,
  start: number,
  language: string | undefined,
  needle: string,
): boolean {
  if (!language) return false;
  if (
    language === "es" &&
    start > 0 &&
    haystack[start - 1] === "e" &&
    !isWordChar(charBefore(haystack, start - 1)) &&
    SPANISH_PROSTHETIC.test(needle)
  ) {
    return true;
  }
  const prefixes = LANGUAGE_PREFIXES[language];
  if (!prefixes) return false;
  for (const prefix of prefixes) {
    if (start < prefix.length) continue;
    if (haystack.slice(start - prefix.length, start) !== prefix) continue;
    if (!isWordChar(charBefore(haystack, start - prefix.length))) return true;
  }
  return false;
}

function allowedInflection(
  needle: string,
  suffix: string,
  language: string | undefined,
): boolean {
  if (!suffix) return true;
  if (suffix.length > 5) return false;
  // Redoublement de la consonne finale : flop → flopped, plan → planned.
  if (
    suffix.startsWith(needle.slice(-1)) &&
    DOUBLED_INFLECTION.test(suffix.slice(1))
  ) {
    return true;
  }
  const table = language
    ? (INFLECTION_SUFFIXES[language] ?? DEFAULT_INFLECTION_SUFFIXES)
    : DEFAULT_INFLECTION_SUFFIXES;
  if (!table.includes(suffix)) return false;
  // « d » n'est un passé que derrière un e : curve+d, hype+d… pas stan+d.
  if (suffix === "d" && !needle.endsWith("e")) return false;
  // « r » d'infinitif roman : cramer (fr), tirar (es), gwagwarmayar (ha).
  if (suffix === "r") {
    const vowelEnd = /[aeo]$/.test(needle);
    const allowsR = language === "fr" || language === "es" || language === "ha";
    if (!vowelEnd || !allowsR) return false;
  }
  return true;
}

export type CompiledExpression = {
  /** Forme normalisée réellement cherchée (ponctuation finale retirée). */
  readonly needle: string;
  /** Langue de l'expression, quand elle est connue. */
  readonly language?: string;
  /** Vrai pour une écriture sans séparateur de mots (inclusion directe). */
  readonly continuousScript: boolean;
  /** Vrai pour 1 à 3 caractères : mot entier exigé. */
  readonly short: boolean;
  /** `normalizedHaystack` doit venir de `normalizeForLexicalMatch`. */
  test(normalizedHaystack: string): boolean;
};

/**
 * Compile une expression du catalogue en matcher réutilisable.
 *
 * Retourne `null` quand l'expression ne contient aucun caractère porteur de
 * sens (ponctuation seule, chaîne vide) : aucune comparaison sûre n'est
 * possible, et l'ignorer vaut mieux qu'un match arbitraire.
 */
export function compileExpression(
  expression: string,
  language?: string,
): CompiledExpression | null {
  const needle = normalizeForLexicalMatch(expression)
    .replace(TRAILING_SENTENCE_PUNCTUATION, "")
    .trim();
  if (!needle || !SOME_WORD_CHAR.test(needle)) return null;
  const continuousScript = CONTINUOUS_SCRIPT.test(needle);
  const short = [...needle].length <= 3;
  const multiWord = needle.includes(" ");

  return {
    needle,
    language,
    continuousScript,
    short,
    test(normalizedHaystack: string): boolean {
      if (!normalizedHaystack) return false;
      // Seule une expression d'écriture continue utilise l'inclusion directe.
      // Un texte mixte (CJK + latin) ne doit pas transformer « PE » en
      // sous-chaîne : les frontières restent la règle pour les expressions
      // latines, même dans une ligne chinoise.
      if (continuousScript) {
        return normalizedHaystack.includes(needle);
      }
      const lastStart = normalizedHaystack.length - needle.length;
      if (lastStart < 0) return false;
      const firstNeedleChar = charAfter(needle, 0);
      const lastNeedleChar = charBefore(needle, needle.length);
      let from = 0;
      while (from <= lastStart) {
        const at = normalizedHaystack.indexOf(needle, from);
        if (at < 0) return false;
        const left =
          isBoundaryBetween(
            firstNeedleChar,
            charBefore(normalizedHaystack, at),
          ) ||
          hasLanguagePrefix(normalizedHaystack, at, language, needle);
        const right = isBoundaryBetween(
          lastNeedleChar,
          charAfter(normalizedHaystack, at + needle.length),
        );
        if (left && right) return true;
        if (left) {
          // Fin de mot plus longue : accepter uniquement une flexion connue.
          let end = at + needle.length;
          while (
            end < normalizedHaystack.length &&
            isWordChar(charAfter(normalizedHaystack, end))
          ) {
            end++;
          }
          const suffix = normalizedHaystack.slice(at + needle.length, end);
          const finalWord = multiWord
            ? needle.slice(needle.lastIndexOf(" ") + 1)
            : "";
          const inflectable =
            !multiWord || !NON_INFLECTABLE_FINAL_WORDS.has(finalWord);
          if (
            inflectable &&
            (short ? suffix === "s" : allowedInflection(needle, suffix, language))
          ) {
            return true;
          }
        }
        // Un match au milieu d'un mot (ratio dans duration, mano dans
        // hermano) n'est jamais accepté.
        from = at + 1;
      }
      return false;
    },
  };
}

/**
 * Raccourci pour les tests et les usages ponctuels. Préférer
 * `compileExpression` + des haystacks normalisés une fois quand plusieurs
 * expressions sont comparées au même texte.
 */
export function expressionMatches(
  haystack: string,
  expression: string,
  language?: string,
): boolean {
  const compiled = compileExpression(expression, language);
  return compiled ? compiled.test(normalizeForLexicalMatch(haystack)) : false;
}
