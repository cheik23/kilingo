/* ═══════════════════════════════════════════════════════════════════════
   IMPORT LSF — WIKIMEDIA COMMONS (API officielle, une seule fois)

   Objectif : fabriquer `src/data/lsf-signs.json`, la liste des clips de
   signes LSF que la section « Langue des signes » affichera, avec la
   licence de CHAQUE fichier lue dans ses métadonnées.

   Règles non négociables :

     · API MediaWiki officielle uniquement (`commons.wikimedia.org/w/api.php`).
       Aucun scraping, aucune copie de page HTML, aucun contournement.
     · AUCUNE licence supposée. `LicenseShortName` est lu fichier par
       fichier, et tout fichier dont la licence n'est pas strictement
       `CC0`, `CC BY 3.0` ou `CC BY 4.0` est REJETÉ et compté. Le rapport
       final affiche le détail des rejets : une base de signes ne peut
       pas reposer sur une intention.
     · Les clips Elix (CC BY-SA) sont exclus par construction : le
       copyleft est incompatible avec l'usage commercial visé.
     · Aucun fichier n'est téléchargé par ce script : il n'interroge que
       l'API. Les vidéos restent hébergées par Wikimedia et la base n'en
       garde que l'URL — la dépendance externe est documentée.

   Usage : node scripts/import-lsf-signs.mjs
   ═══════════════════════════════════════════════════════════════════════ */

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const API = "https://commons.wikimedia.org/w/api.php";
/* Wikimedia exige un User-Agent identifiant le projet. Même forme que
   `contactHeaders()` côté Convex. */
const UA = "Kilingo/1.0 (https://github.com/kilingo; LSF sign section) node-fetch";

/** Les seules licences acceptées. Toute autre valeur → rejet. */
const ALLOWED = new Map([
  ["CC0", "CC0"],
  ["CC BY 3.0", "CC BY 3.0"],
  ["CC BY 4.0", "CC BY 4.0"],
  ["CC BY 3.0 Unported", "CC BY 3.0"],
  ["CC BY 4.0 International", "CC BY 4.0"],
]);

/** Les deux sous-ensembles retenus à la recherche. */
const SETS = [
  {
    id: "lingualibre",
    category: "Category:Lingua Libre pronunciation-fsl",
    label: "Lingua Libre (Wikimedia France)",
  },
  {
    id: "jauvert",
    category: "Category:Vidéos LSF par Laura Jauvert",
    label: "Vidéos LSF — Laura Jauvert",
  },
];

/* ── Thèmes : une liste de mots-clés LUE dans le titre du fichier ──────
   Ce n'est pas un classement inventé : rien n'est créé, on range ce qui
   existe. Un signe qui ne correspond à aucun mot-clé tombe dans
   « Autres », qui reste affiché — jamais un signe caché pour être
   rangé ailleurs.                                                     */
const THEMES = [
  { id: "salutations", label: "Salutations", words: ["bonjour", "salut", "bonsoir", "au revoir", "adieu", "merci", "de rien", "oui", "non", "excuse", "excuses", "pardon", "bienvenue", "à bientôt", "bonne journée", "bonne nuit", "félicitations", "flickr", "accueil", "coucou", "bonne arrivée", "enchanté"] },
  { id: "identite", label: "Identité", words: ["je", "tu", "il", "elle", "nous", "vous", "ils", "elles", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "nos", "vos", "leur", "moi", "toi", "soi", "qui", "quoi", "où", "quel", "quelle", "comment", "pourquoi", "combien", "personne", "gens", "homme", "femme", "enfant", "adulte", "ami", "amie", "nom", "prénom", "âge", "nationalité", "autonome", "indépendant"] },
  { id: "famille", label: "Famille", words: ["mère", "père", "parent", "parents", "frère", "sœur", "soeur", "fils", "fille", "enfant", "époux", "épouse", "mari", "mariage", "grand-mère", "grand-père", "petit-fils", "petite-fille", "cousin", "cousine", "oncle", "tante", "neveu", "nièce", "couple", "mariée", "divorce"] },
  { id: "nombres", label: "Nombres", words: ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "vingt", "trente", "quarante", "cinquante", "cent", "nombre", "chiffre", "numéro", "premier", "deuxième", "troisième"] },
  { id: "temps", label: "Temps", words: ["jour", "nuit", "matin", "soir", "aujourd'hui", "demain", "hier", "maintenant", "temps", "heure", "minute", "seconde", "semaine", "mois", "année", "an", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche", "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre", "toujours", "jamais", "déjà", "bientôt", "venir", "aller", "partir", "rester", "durée", "horaire", "été", "hiver", "printemps", "automne"] },
  { id: "lieu", label: "Lieux", words: ["maison", "école", "travail", "ville", "pays", "rue", "route", "magasin", "restaurant", "hôpital", "église", "gare", "aéroport", "avion", "train", "voiture", "vélo", "bateau", "cinéma", "musée", "banque", "bureau", "chambre", "cuisine", "salle", "jardin", "plage", "montagne", "lac", "forêt", "porte", "fenêtre", "table", "chaise", "lit", "ordinateur", "téléphone", "billet", "carte", "vacances", "voyage", "argent", "prix", "escalier", "ascenseur", "couloir", "toilettes", "terrasse", "jardin", "escalade"] },
  { id: "corps", label: "Corps et santé", words: ["manger", "boire", "dormir", "main", "mains", "tête", "œil", "yeux", "bouche", "nez", "oreille", "bras", "jambe", "pied", "ventre", "cœur", "médecin", "docteur", "malade", "douleur", "fatigué", "soif", "faim", "santé", "hôpital", "médicament", "pharmacie"] },
  { id: "emotions", label: "Émotions", words: ["aimer", "bien", "mal", "content", "triste", "fâché", "fache", "peur", "joie", "contentement", "rire", "pleurer", "drôle", "drole", "honte", "orgueil", "amitié", "haine", "calme", "stressé", "fier", "envie", "surprise", "confiance", "solitude", "seul", "seule"] },
  { id: "communication", label: "Communication", words: ["parler", "dire", "écouter", "comprendre", "question", "répondre", "réponse", "expliquer", "demander", "appeler", "téléphoner", "message", "lettre", "écrire", "lire", "apprendre", "informer", "bavarder", "prévenir", "promettre", "chercher", "trouver", "donner", "prendre", "oublier", "entendre", "conseil", "conseiller", "consultation", "annonce", "réunion", "rendez-vous", "conversation", "mot", "phrase", "histoire", "conte"] },
  { id: "viecourante", label: "Vie courante", words: ["acheter", "achat", "vendre", "caisse", "boutique", "prix", "argent", "euro", "monnaie", "payer", "facture", "dépense", "budget", "assurance", "colis", "courrier", "livrer", "commande", "commander", "dossier", "carte", "banque", "guichet", "file", "attendre", "RDV"] },
  { id: "culture", label: "Culture et loisirs", words: ["livre", "livres", "bibliothèque", "bibliobus", "bd", "cd", "dvd", "bande dessinée", "dessin animé", "dessin", "musique", "chanson", "film", "cinéma", "théâtre", "concert", "spectacle", "sport", "football", "jeu", "jouer", "sortir", "vacances", "fête", "noël", "anniversaire", "photo", "vidéo", "écran", "ordinateur", "téléphone", "email", "mail", "adresse", "numéro"] },
  { id: "nature", label: "Nature et animaux", words: ["chien", "chat", "oiseau", "cheval", "vache", "lapin", "crabe", "poisson", "serpent", "tortue", "araignée", "insecte", "abeille", "arbre", "fleur", "forêt", "mer", "plage", "montagne", "rivière", "soleil", "lune", "étoile", "ciel", "pluie", "neige", "vent", "feu", "terre", "animal", "animaux"] },
];

const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Thème = premier mot-clé trouvé dans le gloss, par MOT ENTIER.
 * Une recherche par sous-chaîne rangeait « cOUs » dans « où » et
 * « AnTOIne » dans « toi » : 60 % de faux positifs. Un gloss n'est
 *containu dans un thème que si un mot de la liste y figure
 * exactement.
 */
function themeOf(gloss) {
  const g = norm(gloss);
  for (const theme of THEMES) {
    for (const word of theme.words) {
      const w = norm(word);
      // Frontières de MOT des deux côtés : « au revoir » matche, « auteur »
      // ne matche pas, et « toi » ne matche pas « Antoine ».
      if (new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`, "u").test(g)) {
        return theme.id;
      }
    }
  }
  return "autres";
}

/* ── Lecture de l'API ──────────────────────────────────────────────── */

async function api(params) {
  const search = new URLSearchParams({ format: "json", formatversion: "2" });
  // `undefined` devient la chaîne "undefined" dans URLSearchParams : on
  // n'ajoute donc que les paramètres réellement définis.
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") search.set(k, v);
  }
  const url = `${API}?${search.toString()}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`API ${res.status} sur ${url}`);
  const json = await res.json();
  if (json.error) throw new Error(`API erreur : ${JSON.stringify(json.error)}`);
  return json;
}

const META_FILTER = [
  "LicenseShortName",
  "UsageTerms",
  "LicenseUrl",
  "Artist",
  "AttributionRequired",
].join("|");

async function filesOfCategory(category) {
  const out = [];
  let cont = null;
  do {
    const data = await api({
      action: "query",
      generator: "categorymembers",
      gcmtitle: category,
      gcmtype: "file",
      gcmlimit: "500",
      gcmcontinue: cont ?? undefined,
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiextmetadatafilter: META_FILTER,
    });
    for (const page of data.query?.pages ?? []) {
      const info = Array.isArray(page.imageinfo) ? page.imageinfo[0] : page.imageinfo;
      if (info) out.push({ title: page.title, info });
    }
    cont = data.continue?.gcmcontinue ?? null;
  } while (cont);
  return out;
}

const html = (v) =>
  typeof v === "string"
    ? v
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/\s+/g, " ")
        .trim()
    : "";

/**
 * Le gloss est le NOM DU FICHIER, moins le nom du signeur (lu dans les
 * métadonnées `Artist`, jamais deviné) et l'extension. On n'invente donc
 * aucune traduction : on affiche ce que la source a publié. La fiche le
 * marque « à valider » et ouvre un bouton « Signaler une erreur ».
 */
function glossOf(fileTitle, setId, signer) {
  const base = fileTitle
    .replace(/\.(webm|ogv|ogg|mp4|mov)$/i, "")
    .replace(/\s*-\s*Elix$/i, "")
    .replace(/\s*\((?:théâtre|lieu|liste)\)\s*$/i, "");
  // Les DEUX sous-ensembles retenus portent le même préfixe de nommage
  // Wikimedia `LL-Qxxxxx (fsl)-`. Le retirer par ensemble (et non pour le
  // seul Lingua Libre) laissait 445 glosss Jauvert affichés en entier —
  // dont « LL-Q33302 (fsl)-Laura Jauvert-À genoux » : le mot affiché
  // n'était pas le mot, mais le nom du fichier.
  if (!/^LL-Q\d+\s*\(fsl\)-/.test(base)) return base.trim();
  let rest = base.replace(/^LL-Q\d+\s*\(fsl\)-/, "");
  // Le signeur peut être écrit dans l'autre sens que les métadonnées :
  // `Artist` dit « Jauvert Laura », le nom de fichier dit « Laura Jauvert ».
  // On retire donc toute permutation des jetons du signeur, jamais devinée.
  if (signer) {
    // Le nom complet d'abord : certains signeurs ont un pseudonyme
    // Workspace (Wikimedia) qui se termine par un numero
    // (« Roy Batty 82 ») — seul le nom entier correspond au fichier.
    const full = signer.trim();
    if (full.length > 3 && rest.toLowerCase().startsWith(full.toLowerCase())) {
      rest = rest.slice(full.length);
    }
    const tokens = signer.split(/[\s,]+/).filter(Boolean);
    for (let i = 0; i < tokens.length && rest !== ""; i++) {
      for (let j = 0; j < tokens.length; j++) {
        if (i === j) continue;
        const name = `${tokens[i]} ${tokens[j]}`.trim();
        if (name.length > 3 && rest.toLowerCase().startsWith(name.toLowerCase())) {
          rest = rest.slice(name.length);
          i = tokens.length;
          break;
        }
      }
    }
  }
  return rest
    .replace(/^\s*\([^)]*\)\s*[-–—]?\s*/, "")
    .replace(/^[-–—\s]+/, "")
    .replace(/[-–—\s]+$/, "")
    .trim();
}

/**
 * Six fichiers de la catégorie Jauvert portent le nom d'un PRÉSET DE
 * CAMÉRA, pas celui d'un signe (« MRV, R137-cam 720px-light 2x spots +
 * no sun »). Le motif est volontairement étroit : sur les 750 titres
 * retenus il ne capture que ces 6 fichiers et aucun mot légitime.
 * Un gloss illisible n'est pas un signe, et l'afficher serait inventer du
 * contenu : ils sont rejetés et comptés, pas devinés.
 */
const CAMERA_ARTEFACT =
  /\bcouloir-cam\b|\b\d{3,4}\s?px\b|\bno sun\b|\bsunny\b|\bno spots\b|\bComputYourself\b|\bYug-MRV\b|\bAR0\d+\b/i;

function isArtefact(fileTitle) {
  return CAMERA_ARTEFACT.test(fileTitle);
}

/** Le signeur, pas l'enregistreur ni le monteur : lu dans `Artist`. */
function cleanSigner(artist, setId) {
  const flat = html(artist);
  const speaker = flat.match(/Speaker:\s*(.+?)(?:\s*Recorder:|$)/i);
  if (speaker) return speaker[1].trim();
  const original = flat.match(/Original video:\s*(.+?)(?:\s*Video editing:|$)/i);
  if (original) return original[1].trim();
  if (!flat) return setId === "jauvert" ? "Laura Jauvert" : "Communauté Lingua Libre";
  return flat.slice(0, 80);
}

/* ── Traitement ────────────────────────────────────────────────────── */

const rejects = { licence: [], horsDomaine: [], elix: [], artefact: [] };
const signs = [];

for (const set of SETS) {
  const files = await filesOfCategory(set.category);
  let kept = 0;
  for (const { title, info } of files) {
    const meta = info.extmetadata ?? {};
    const raw = html(meta.LicenseShortName?.value);
    const license = ALLOWED.get(raw);

    if (raw && /by-sa/i.test(raw)) {
      rejects.elix.push({ title, license: raw });
      continue;
    }
    if (!license) {
      rejects.licence.push({ title, license: raw || "(absente)" });
      continue;
    }
    // On ne sert que ce que Wikimedia sert lui-même : le domaine de
    // diffusion, vérifié, pas une URL devinée.
    if (!info.url || !info.url.startsWith("https://upload.wikimedia.org/")) {
      rejects.horsDomaine.push({ title, url: info.url ?? "(absente)" });
      continue;
    }
    if (!/^video\//.test(info.mime ?? "")) continue;

    const fileTitle = title.replace(/^File:/, "");
    if (isArtefact(fileTitle)) {
      rejects.artefact.push({ title });
      continue;
    }
    const signer = cleanSigner(meta.Artist?.value, set.id);
    const gloss = glossOf(fileTitle, set.id, signer);
    if (!gloss) continue;

    const entry = {
      id: title.replace(/^File:/, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase(),
      gloss,
      fileTitle: title.replace(/^File:/, ""),
      theme: themeOf(gloss),
      sourceSet: set.id,
      sourceLabel: set.label,
      signer,
      license,
      usageTerms: html(meta.UsageTerms?.value),
      licenseUrl: html(meta.LicenseUrl?.value),
      attributionRequired: html(meta.AttributionRequired?.value) === "true",
      descriptionUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
      // L'API ajoute des paramètres de suivi (utm_*) à l'URL du fichier.
      // On les retire : le contenu est servi identiquement, et on n'envoie
      // pas de requête.trackable depuis l'app.
      videoUrl: info.url.split("?")[0],
      mime: info.mime,
      bytes: info.size ?? 0,
      /** Les glosss viennent des titres de fichiers : jamais validés. */
      verified: false,
    };
    signs.push(entry);
    kept += 1;
  }
  console.log(`${set.label} : ${files.length} fichiers, ${kept} retenus`);
}

/* Deux titres Commons peuvent normaliser vers le même id : on garde le
   premier et on compte, plutôt que d'écraser silencieusement. */
const seen = new Set();
const unique = signs.filter((s) => {
  if (seen.has(s.id)) return false;
  seen.add(s.id);
  return true;
});

unique.sort((a, b) => a.gloss.localeCompare(b.gloss, "fr"));

/* Les compteurs sont faits APRÈS dédoublonnage : un décompte établi
   pendant la boucle annonçait plus de clips que la base n'en contient,
   et le poids total était faux du même montant. */
const byLicense = new Map();
let totalBytes = 0;
for (const s of unique) {
  byLicense.set(s.license, (byLicense.get(s.license) ?? 0) + 1);
  totalBytes += s.bytes;
}

const payload = {
  generatedAt: new Date().toISOString(),
  generator: "scripts/import-lsf-signs.mjs",
  source: "Wikimedia Commons — API MediaWiki officielle",
  /** Vrai tant que la base ne contient que des clips Wikimedia. */
  hosting: "external",
  hostingNote:
    "Les clips sont servis par upload.wikimedia.org depuis les URL de l'API. Aucune copie n'est hébergée : la base ne stocke que l'URL, la licence et le crédit.",
  counts: {
    total: unique.length,
    /** Fichiers vus puis écartés : deux titres Commons normalisés idem. */
    duplicates: signs.length - unique.length,
    byLicense: Object.fromEntries([...byLicense.entries()].sort()),
    bySourceSet: unique.reduce((acc, s) => ({ ...acc, [s.sourceSet]: (acc[s.sourceSet] ?? 0) + 1 }), {}),
    byTheme: unique.reduce((acc, s) => ({ ...acc, [s.theme]: (acc[s.theme] ?? 0) + 1 }), {}),
    totalBytes,
  },
  themes: THEMES.map((t) => ({ id: t.id, label: t.label })).concat([{ id: "autres", label: "Autres" }]),
  signs: unique,
};

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "lsf-signs.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(payload, null, 1)}\n`, "utf8");

const mb = (n) => `${(n / 1_048_576).toFixed(1)} Mo`;
console.log("\n── RÉSULTAT ──");
console.log(`retenus            : ${unique.length}`);
for (const [lic, n] of [...byLicense.entries()].sort()) console.log(`  ${lic.padEnd(12)} : ${n}`);
console.log(`poids total        : ${mb(totalBytes)} (${totalBytes} octets)`);
console.log(`rejetés licence    : ${rejects.licence.length}`);
for (const r of rejects.licence.slice(0, 8)) console.log(`   - ${r.title} (${r.license})`);
console.log(`rejetés CC BY-SA   : ${rejects.elix.length}`);
for (const r of rejects.elix.slice(0, 5)) console.log(`   - ${r.title} (${r.license})`);
console.log(`rejetés hors domaine: ${rejects.horsDomaine.length}`);
console.log(`rejetés nom de fichier non-signe: ${rejects.artefact.length}`);
for (const r of rejects.artefact.slice(0, 8)) console.log(`   - ${r.title}`);
console.log(`écrit              : ${out}`);
