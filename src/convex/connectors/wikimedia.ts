import { detectLicense, licenseByCode, statusFromLicense } from "../ovRights";
import { contactHeaders } from "../ovEnv";
import { getJson, stripHtml, txt, type ConnectorSpec, type RawHit, type SearchOpts } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   WIKIMÉDIA — Commons (médias), Wikipédia (articles), Wikinews (actualités)

   Trois sources sous licence libre, donc réellement exploitables :
     · Commons  : CC / domaine public, licence lue fichier par fichier ;
     · Wikipédia: CC BY-SA 4.0 — lecture, traduction et dérivés autorisés
                  avec attribution et partage à l'identique ;
     · Wikinews : CC BY 2.5 — articles d'actualité, redistribution et
                  traduction autorisées avec attribution.

   On ne récupère que du texte déjà publié sous licence libre : aucun
   contournement, aucune copie de contenu protégé.
   ═══════════════════════════════════════════════════════════════════════ */

const USER_AGENT = contactHeaders();

/** Wikipédia et Wikinews partagent la même API MediaWiki. */
type WikiProject = {
  host: string;
  source: string;
  licence: "CC-BY-SA" | "CC-BY";
  /** Nom affiché de la source. */
  label: string;
  /** Filtre de recherche propre au projet (Wikinews : articles publiés). */
  discoverQuery: string;
};

const PROJECTS: Record<string, WikiProject> = {
  wikipedia: {
    host: "fr.wikipedia.org",
    source: "wikipedia",
    licence: "CC-BY-SA",
    label: "Wikipédia",
    discoverQuery: "incategory:\"Article de qualité\"",
  },
  wikinews: {
    host: "fr.wikinews.org",
    source: "wikinews",
    licence: "CC-BY",
    label: "Wikinews",
    discoverQuery: "incategory:\"Article publié\"",
  },
};

type SearchResult = { title?: string; pageid?: number; timestamp?: string; snippet?: string; wordcount?: number };
type ExtractPage = { pageid?: number; title?: string; extract?: string };

const BODY_LIMIT = 12_000;

async function searchArticles(
  project: WikiProject,
  query: string,
  rows: number,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srsort: "create_timestamp_desc",
    srlimit: String(Math.min(Math.max(rows, 2), 20)),
    srnamespace: "0",
    srprop: "timestamp|snippet|wordcount",
    format: "json",
  });
  const data = await getJson<{ query?: { search?: SearchResult[] } }>(
    `https://${project.host}/w/api.php?${params.toString()}`,
    USER_AGENT,
    12_000,
  );
  return data.query?.search ?? [];
}

/**
 * Récupère le texte brut des articles, un titre par appel.
 *
 * Requête groupée volontairement écartée : `prop=extracts` avec plusieurs
 * titres renvoie des extraits VIDES dès que le total dépasse son budget
 * interne (vérifié sur l'API : 3 pages sur 4 vides en groupé, 35 000
 * caractères pour la même page seule). Un appel par article, en parallèle et
 * plafonné, donne un texte fiable ; on tronque ensuite côté serveur.
 */
async function fetchExtracts(project: WikiProject, titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const capped = titles.slice(0, 10);
  if (!capped.length) return out;

  const settled = await Promise.allSettled(
    capped.map(async (title) => {
      const params = new URLSearchParams({
        action: "query",
        prop: "extracts",
        explaintext: "1",
        titles: title,
        format: "json",
      });
      const data = await getJson<{ query?: { pages?: Record<string, ExtractPage> } }>(
        `https://${project.host}/w/api.php?${params.toString()}`,
        USER_AGENT,
        15_000,
        0,
      );
      const page = Object.values(data.query?.pages ?? {})[0];
      return { title, extract: page?.extract?.slice(0, BODY_LIMIT) };
    }),
  );

  for (const result of settled) {
    if (result.status === "fulfilled" && result.value.extract) {
      out.set(result.value.title, result.value.extract);
    }
  }
  return out;
}

async function articleHits(project: WikiProject, query: string, rows: number): Promise<RawHit[]> {
  const found = await searchArticles(project, query, rows);
  if (!found.length) return [];
  const titles = found.map((r) => r.title).filter((t): t is string => Boolean(t));
  const extracts = await fetchExtracts(project, titles);

  return found.map((result) => {
    const title = result.title ?? "Article";
    const body = extracts.get(title);
    const facts = licenseByCode(project.licence);
    const url = `https://${project.host}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
    return {
      source: project.source,
      externalId: String(result.pageid ?? title),
      kind: "article",
      title,
      creator: project.label,
      creatorKind: "institution",
      language: project.host.slice(0, 2),
      genres: ["actualité", "culture"],
      description: stripHtml(result.snippet).slice(0, 300) || undefined,
      externalUrl: url,
      body,
      mediaFormat: "text",
      publishedAt: result.timestamp ? Date.parse(result.timestamp) || undefined : undefined,
      lastUpdatedAt: result.timestamp ? Date.parse(result.timestamp) || undefined : undefined,
      rightsStatus: statusFromLicense(facts),
      license: facts,
      attribution: `${project.label} — CC ${project.licence === "CC-BY-SA" ? "BY-SA 4.0" : "BY 2.5"}`,
      subtype: "article",
    } satisfies RawHit;
  });
}

/* ── Wikipédia ──────────────────────────────────────────────────────── */

export const wikipedia: ConnectorSpec = {
  key: "wikipedia",
  kinds: ["article"],
  search: (q, opts) => articleHits(PROJECTS.wikipedia, q, opts.rows),
  discover: (opts) => articleHits(PROJECTS.wikipedia, PROJECTS.wikipedia.discoverQuery, opts.rows),
};

/* ── Wikinews ───────────────────────────────────────────────────────── */

export const wikinews: ConnectorSpec = {
  key: "wikinews",
  kinds: ["article"],
  search: (q, opts) => articleHits(PROJECTS.wikinews, q, opts.rows),
  // Les articles publiés les plus récents, sans mot-clé.
  discover: (opts) => articleHits(PROJECTS.wikinews, PROJECTS.wikinews.discoverQuery, opts.rows),
};

/* ── Wikimedia Commons (médias libres) ──────────────────────────────── */

type CommonsPage = {
  title?: string;
  imageinfo?: {
    url?: string;
    descriptionurl?: string;
    mime?: string;
    thumburl?: string;
    extmetadata?: Record<string, { value?: unknown }>;
  }[];
};

function commonsFiletype(kind: SearchOpts["kind"]): string {
  if (kind === "movie" || kind === "series" || kind === "video") return " filetype:video";
  if (kind === "audio" || kind === "music" || kind === "podcast") return " filetype:audio";
  if (kind === "image") return " filetype:bitmap";
  return "";
}

export const wikimedia: ConnectorSpec = {
  key: "wikimedia_commons",
  kinds: ["image", "video", "audio", "book"],
  search: async (q, opts) => {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: q + commonsFiletype(opts.kind),
      gsrnamespace: "6",
      gsrlimit: String(Math.min(Math.max(opts.rows, 3), 20)),
      prop: "imageinfo",
      iiprop: "url|mime|size|extmetadata",
      iiurlwidth: "480",
    });
    const data = await getJson<{ query?: { pages?: Record<string, CommonsPage> } }>(
      `https://commons.wikimedia.org/w/api.php?${params.toString()}`,
      USER_AGENT,
      12_000,
    );
    const hits: RawHit[] = [];
    for (const page of Object.values(data.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (!info?.url) continue;
      const meta = info.extmetadata ?? {};
      const facts = detectLicense({
        licenseUrl: txt(meta.LicenseUrl?.value),
        usageTerms: txt(meta.UsageTerms?.value),
        licenseName: txt(meta.LicenseShortName?.value),
      });
      const mime = info.mime ?? "";
      const kind: RawHit["kind"] = mime.startsWith("video")
        ? "video"
        : mime.startsWith("audio")
          ? "audio"
          : /pdf|djvu|epub|text\//.test(mime)
            ? "book"
            : "image";
      hits.push({
        source: "wikimedia_commons",
        externalId: (page.title ?? "").replace("File:", ""),
        kind,
        title: (page.title ?? "Fichier").replace("File:", ""),
        creator: txt(meta.Artist?.value),
        creatorKind: "creator",
        description: txt(meta.ImageDescription?.value),
        thumbnail: info.thumburl ?? info.url,
        externalUrl:
          info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title ?? "")}`,
        streamUrl: info.url,
        mediaFormat: mime.split("/").pop() ?? "media",
        rightsStatus: statusFromLicense(facts),
        license: facts,
        attribution: txt(meta.Artist?.value) ?? "Wikimedia Commons",
        subtype: "commons",
      });
    }
    return hits;
  },
};
