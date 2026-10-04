"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { getText, stripHtml, toEpoch } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   PODCAST FEED — flux RSS (XML) parsé CÔTE SERVEUR : <enclosure url=".mp3">
   extraits du flux officiel de l'éditeur. Cache 24 h ovSourceCache. Les
   épisodes restent jouables en MP3 complet (écoute publique prévue par
   l'éditeur) ; la transcription passe par les pipelines existants.
   ═══════════════════════════════════════════════════════════════════════ */

export type PodcastEpisode = {
  title: string;
  date: string;
  audioUrl: string;
  description: string;
  /** Image d'épisode quand le flux en fournit une. */
  imageUrl?: string;
  /** Durée en secondes quand <itunes:duration> est présent. */
  durationSec?: number;
};

/** Regex enclosure robuste : ordre d'attributs quelconque, url &amp;-unescaped. */
function enclosureOf(block: string): string | null {
  const tag = block.match(/<enclosure\b[^>]*>/i)?.[0];
  if (!tag) return null;
  const url = /url\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
  if (!url) return null;
  return url.replace(/&amp;/g, "&");
}

function cdata(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
}

/**
 * `bunx convex run connectors/podcastFeed:podcastFeedEpisodes
 *   '{"feedUrl":"https://…/feed.xml","limit":12}'`
 * → épisodes réels avec audioUrl (enclosure MP3) non vide.
 */
export const podcastFeedEpisodes = action({
  args: { feedUrl: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const url = args.feedUrl.trim();
    if (!/^https?:\/\//i.test(url)) throw new Error("URL de flux invalide.");
    const limit = Math.min(Math.max(args.limit ?? 12, 1), 40);
    const cacheKey = `cat:podcast:feed:${url.slice(0, 220)}:${limit}`;
    try {
      const raw = (await ctx.runQuery(internal.lyricsCache.cacheGetLyrics, { cacheKey })) as
        | string
        | null;
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { episodes?: unknown }).episodes)
        ) {
          return parsed as { showTitle: string; imageUrl?: string; episodes: PodcastEpisode[] };
        }
      }
    } catch {
      /* cache illisible → on re-parse */
    }

    const xml = await getText(url, { Accept: "application/rss+xml, application/xml, text/xml, */*" }, 15_000);
    const head = xml.slice(0, 4000);
    const showTitle = stripHtml(cdata(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]));
    const imageUrl =
      xml.match(/<itunes:image[^>]*href\s*=\s*"([^"]+)"/i)?.[1] ??
      xml.match(/<image>[\s\S]*?<url>([\s\S]*?)<\/url>/i)?.[1] ??
      undefined;

    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? [];
    const episodes: PodcastEpisode[] = [];
    for (const block of blocks) {
      const title = stripHtml(cdata(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]));
      if (!title) continue;
      const audioUrl = enclosureOf(block);
      if (!audioUrl || !/^https?:\/\//i.test(audioUrl)) continue;
      // Garde-fou : une enclosure vidéo n'est pas un épisode MP3 écoutable
      // dans le lecteur audio natif — on la laisse au connecteur vidéo.
      const type = /<enclosure\b[^>]*>/i.exec(block)?.[0]?.match(/type\s*=\s*"([^"]+)"/i)?.[1] ?? "";
      if (type && !/^(audio|video)\//i.test(type)) continue;
      const pubDate = cdata(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]);
      const description = stripHtml(
        cdata(block.match(/<description>([\s\S]*?)<\/description>/i)?.[1]),
      ).slice(0, 300);
      const durRaw = cdata(block.match(/<itunes:duration>([\s\S]*?)<\/itunes:duration>/i)?.[1]);
      let durationSec: number | undefined;
      if (/^\d+$/.test(durRaw)) durationSec = Number(durRaw);
      else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(durRaw)) {
        durationSec = durRaw.split(":").reduce((acc, p) => acc * 60 + Number(p), 0);
      }
      episodes.push({
        title,
        date: pubDate || (toEpoch(pubDate) ? new Date(toEpoch(pubDate)!).toISOString().slice(0, 10) : ""),
        audioUrl,
        description,
        ...(block.match(/<itunes:image[^>]*href\s*=\s*"([^"]+)"/i)?.[1]
          ? { imageUrl: block.match(/<itunes:image[^>]*href\s*=\s*"([^"]+)"/i)![1] }
          : {}),
        ...(durationSec !== undefined ? { durationSec } : {}),
      });
      if (episodes.length >= limit) break;
    }

    const out = { showTitle, ...(imageUrl ? { imageUrl } : {}), episodes };
    try {
      await ctx.runMutation(internal.lyricsCache.cachePutLyrics, {
        cacheKey,
        payload: [JSON.stringify(out)],
      });
    } catch {
      /* best-effort */
    }
    return out;
  },
  returns: v.object({
    showTitle: v.string(),
    imageUrl: v.optional(v.string()),
    episodes: v.array(
      v.object({
        title: v.string(),
        date: v.string(),
        audioUrl: v.string(),
        description: v.string(),
        imageUrl: v.optional(v.string()),
        durationSec: v.optional(v.number()),
      }),
    ),
  }),
});
