import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { transcribeAudio } from "./youtubePipeline";
import {
  DIRECT_LIMIT,
  detectContainer,
  splitMp3,
  splitRaw,
} from "./chunkingCore";

/* ═══════════════════════════════════════════════════════════════════
   Transcription longue — chunking > 25 Mo (limite HTTP du moteur ASR).

   - HEAD Content-Length → ≤ 24 Mo : chemin direct (24 Mo garde une
     marge sous la limite serveur de 25 Mo) ;
   - > 24 Mo : découpe ~20 Mo alignée sur les frames mp3 (sync word
     0xFF ex + layer/bits plausibles), découpe brute pour les autres
     conteneurs (chunk indécodable = warning, jamais d'arrêt) ;
   - chaque chunk → transcribeAudio (moteur asrEngine) verbose_json,
     retry ×2, progression publiée ; tout chunk de ce chemin vient d'un
     média > 24 Mo, donc d'un audio > 2 min → Groq Whisper passe devant le
     worker local (débit constant sur les longs extraits), le worker local
     restant le repli ;
     dans mediaJobs après CHAQUE chunk (live via useQuery) ;
   - reprise : les chunks déjà réussis (job.chunkCache) ne sont pas
     re-transcrits — c'est le « Réessayer » ;
   - fin : segments fusionnés triés, offsets cumulés via data.duration,
     pipeline traduction/argot complet via mediaHub2.analyzeHubSegments.
   ═══════════════════════════════════════════════════════════════════ */

type RawSeg = { start: number; end: number; text: string };
type CachedSeg = { i: number; segments: RawSeg[]; lang?: string };

/** Transcrit un chunk avec 2 retries. */
async function groqWithRetry(
  buf: Buffer,
  filename: string,
): Promise<{ segments: RawSeg[]; lang?: string; duration: number }> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Chemin « fichier long » : audio > 2 min → Groq Whisper en moteur
      // principal (voir asrEngine / connectors/groqWhisper).
      const data = await transcribeAudio(buf, filename, undefined, {
        preferGroq: true,
      });
      const duration = data.segments[data.segments.length - 1]?.end ?? 0;
      return {
        segments: data.segments.map((s) => ({
          start: s.start,
          end: s.end,
          text: s.text,
        })),
        lang: data.lang,
        duration,
      };
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Transcription d'un chunk impossible");
}

export const transcribeLongAudio = action({
  args: {
    jobId: v.id("mediaJobs"),
    language: v.union(
      v.literal("en"),
      v.literal("zh"),
      v.literal("es"),
      v.literal("ar"),
      v.literal("ru"),
    ),
    targetLanguage: v.optional(
      v.union(
        v.literal("en"),
        v.literal("fr"),
        v.literal("zh"),
        v.literal("es"),
        v.literal("ar"),
        v.literal("ru"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(api.mediaJobs.get, { id: args.jobId });
    if (!job) throw new Error("Tâche introuvable.");

    try {
      // ── 1. Téléchargement (serveur) ──────────────────────────────────
      await ctx.runMutation(internal.mediaJobOps.start, {
        jobId: args.jobId,
        step: "media.stepDownload",
      });
      // HEAD d'abord : Content-Length + Content-Type (les gros CDN comme
      // blubrry servent des 302 — fetch les suit nativement).
      try {
        const head = await fetch(job.sourceUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(20_000),
        });
        if (head.ok) {
          const len = head.headers.get("content-length");
          const type = head.headers.get("content-type");
          console.log(
            `[mediaJob] HEAD ${len ? Math.round(Number(len) / 1024 / 1024) + " Mo" : "taille inconnue"} · ${type ?? "type inconnu"}`,
          );
        }
      } catch {
        /* HEAD refusé — le GET reste la source de vérité */
      }
      const res = await fetch(job.sourceUrl, {
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error("Fichier audio injoignable.");
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error("Fichier audio vide.");

      // ── 2. Découpe (ou chemin direct ≤ 24 Mo) ────────────────────────
      const isMp3 = detectContainer(buf, job.sourceUrl) === "mp3";
      const chunks =
        buf.length <= DIRECT_LIMIT
          ? [buf]
          : isMp3
            ? splitMp3(buf)
            : splitRaw(buf);
      const total = chunks.length;
      if (total === 0) throw new Error("Aucun contenu audio découpé.");

      await ctx.runMutation(internal.mediaJobOps.progress, {
        jobId: args.jobId,
        totalChunks: total,
        doneChunks: 0,
        step: `media.stepXofY?done=0&total=${total}`,
      });

      // ── 3. Boucle chunks : cache d'abord, moteur ASR ensuite ──────
      const cache = new Map<number, CachedSeg>(
        ((job.chunkCache ?? []) as CachedSeg[]).map(
          (c) => [c.i, c] as [number, CachedSeg],
        ),
      );
      const merged: RawSeg[] = [];
      let offset = 0;
      let lang: string | undefined;

      for (let i = 0; i < total; i++) {
        const chunk = chunks[i];
        const cached = cache.get(i);
        if (cached) {
          for (const s of cached.segments) {
            merged.push({ start: s.start + offset, end: s.end + offset, text: s.text });
          }
          if (!lang) lang = cached.lang;
          offset += cached.segments[cached.segments.length - 1]?.end ?? 0;
        } else if (chunk.length <= DIRECT_LIMIT) {
          try {
            const out = await groqWithRetry(
              Buffer.from(chunk),
              isMp3 ? "chunk.mp3" : "chunk.audio",
            );
            await ctx.runMutation(internal.mediaJobOps.cacheChunk, {
              jobId: args.jobId,
              i,
              segments: out.segments,
              lang: out.lang,
            });
            for (const s of out.segments) {
              merged.push({ start: s.start + offset, end: s.end + offset, text: s.text });
            }
            if (!lang) lang = out.lang;
            offset += out.duration;
          } catch (e) {
            // Chunk sauté : warning non bloquant, l'offset avance quand même.
            const msg =
              e instanceof Error ? e.message : "chunk transcription error";
            await ctx.runMutation(internal.mediaJobOps.warn, {
              jobId: args.jobId,
              warning: `Extrait ${i + 1}/${total} sauté (${msg})`,
            });
            offset += 0;
          }
        } else {
          await ctx.runMutation(internal.mediaJobOps.warn, {
            jobId: args.jobId,
            warning: `Extrait ${i + 1}/${total} trop volumineux — sauté`,
          });
        }
        await ctx.runMutation(internal.mediaJobOps.progress, {
          jobId: args.jobId,
          totalChunks: total,
          doneChunks: i + 1,
          step: `media.stepXofY?done=${i + 1}&total=${total}`,
        });
      }

      if (merged.length === 0) {
        throw new Error("Aucun segment transcrit dans ce fichier.");
      }

      // ── 4. userMedia + pipeline complet (traduction → argot → DB) ────
      await ctx.runMutation(internal.mediaJobOps.start, {
        jobId: args.jobId,
        step: "media.stepTranslate",
      });
      merged.sort((a, b) => a.start - b.start);
      const mediaId = await ctx.runMutation(api.media.createHubMedia, {
        language: args.language,
        title: job.title,
        sourceName: job.sourceUrl,
        mediaType: "talk",
        targetLanguage: args.targetLanguage,
      });

      await ctx.runAction(api.mediaHub2.analyzeHubSegments, {
        mediaId,
        language: args.language,
        targetLanguage: args.targetLanguage,
        segments: merged,
        transcriptSource: "chunked_audio",
      });

      // ── 5. Job terminé — on relit les sous-titres RÉELS du média ─────
      // Le pipeline ci-dessus a déjà écrit `subtitles` (texte + traduction +
      // argot) sur le média. L'ancien code fabriquait ici ses propres lignes
      // avec `translatedText = texte source` : la colonne traduction
      // affichait la copie exacte de l'original. On stocke donc la sortie du
      // pipeline, projetée explicitement (le validateur refuse tout champ en
      // trop).
      const stored = await ctx.runQuery(internal.media.getMediaInternal, {
        mediaId,
      });
      const subtitles = (stored.subtitles ?? []).map((s) => ({
        id: s.id,
        start: s.start,
        end: s.end,
        originalText: s.originalText,
        translatedText: s.translatedText,
        isSlang: s.isSlang,
        ...(s.words && s.words.length > 0 ? { words: s.words } : {}),
      }));
      await ctx.runMutation(internal.mediaJobOps.complete, {
        jobId: args.jobId,
        mediaId,
        segments: subtitles,
      });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Erreur de transcription inconnue.";
      await ctx.runMutation(internal.mediaJobOps.fail, { jobId: args.jobId, error: msg });
      throw e;
    }
  },
});
