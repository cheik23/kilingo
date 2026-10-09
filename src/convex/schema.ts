import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";
import { subtitleValidator, slangHitValidator } from "./subtitles";
import { segmentValidator } from "./ovRights";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/** Question de quiz servie au client — sans la bonne réponse. */
export const quizQuestionValidator = v.object({
  id: v.string(),
  type: v.union(v.literal("mcq"), v.literal("fill"), v.literal("reverse")),
  prompt: v.string(),
  hint: v.optional(v.string()),
  options: v.array(v.string()),
  example: v.optional(v.string()),
  expression: v.string(),
  meaning: v.string(),
});

/** Version stockée côté serveur : correctIndex ne sort JAMAIS de la table. */
export const quizStoredQuestionValidator = v.object({
  id: v.string(),
  type: v.union(v.literal("mcq"), v.literal("fill"), v.literal("reverse")),
  prompt: v.string(),
  hint: v.optional(v.string()),
  options: v.array(v.string()),
  example: v.optional(v.string()),
  expression: v.string(),
  meaning: v.string(),
  correctIndex: v.number(),
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      // Daily practice goal in minutes (Dashboard "Performance").
      dailyGoalMinutes: v.optional(v.number()),

      /**
       * Fuseau IANA du compte — sert au quota Shadow quotidien.
       *
       * Le reset se fait à minuit CHEZ L'UTILISATEUR, pas en UTC : un
       * quota qui bascule à 2 h du matin pour l'Europe et à 18 h pour
       * l'Afrique n'est pas un quota, c'est une injustice. Le client
       * envoie `Intl.DateTimeFormat().resolvedOptions().timeZone`, le
       * serveur le VALIDE avant de le stocker (une chaîne arbitraire
       * ferait planter `Intl`) et retombe sur UTC s'il est inconnu.
       */
      timezone: v.optional(v.string()),
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // add other tables here

    slangExpressions: defineTable({
      // Includes "fr": French entries power the translated-subtitles experience
      // even though fr is a translation target, not a learning language.
      language: v.union(
        v.literal("en"),
        v.literal("zh"),
        v.literal("es"),
        v.literal("ar"),
        v.literal("ru"),
        v.literal("sw"),
        v.literal("ln"),
        v.literal("ha"),
        v.literal("yo"),
        v.literal("zu"),
        v.literal("wo"),
        v.literal("fr"),
      ),
      expression: v.string(),
      literal: v.optional(v.string()),
      meaning: v.string(),
      context: v.string(),
      register: v.string(), // street | casual | vulgar | internet
      region: v.string(), // US | UK | China | Spain | LatAm | MENA | Russia ...
      popularity: v.number(), // 0-100
      mediaRefs: v.optional(v.array(v.string())),
      // Colonnes dénormalisées pour les lectures indexées (anti-quota) :
      // forme normalisée de `expression` et code pays de `region`.
      // Remplies par slang:seed (backfill idempotent inclus).
      normExpr: v.optional(v.string()),
      regionKey: v.optional(v.string()),
      // Langue du champ `meaning` (défaut implicite "fr" pour la base seedée,
      // "en" pour les importations Urban Dictionary). Permet à l'UI de savoir
      // quand le sens doit passer par la cascade de traduction avant affichage.
      meaningLang: v.optional(v.string()),
    })
      .index("by_language", ["language"])
      .index("by_language_popularity", ["language", "popularity"])
      .index("by_norm_expr", ["normExpr"])
      .index("by_language_region", ["language", "regionKey"]),

    /* Agrégats pré-calculés (anti-quota R6) — une ligne par registre :
       « register:<id> » → nombre d'expressions d'apprentissage (hors « fr »).
       Recalculés par slang:recomputeAggregates (et slang:seed) — les
       dashboards lisent ~6 lignes au lieu de balayer slangExpressions. */
    slangAggregates: defineTable({
      key: v.string(), // "register:street" | "register:casual" | …
      total: v.number(),
    }).index("by_key", ["key"]),

    userLanguages: defineTable({
      userId: v.id("users"),
      language: v.union(
        v.literal("en"),
        v.literal("zh"),
        v.literal("es"),
        v.literal("ar"),
        v.literal("ru"),
        v.literal("sw"),
        v.literal("ln"),
        v.literal("ha"),
        v.literal("yo"),
        v.literal("zu"),
        v.literal("wo"),
      ),
      active: v.boolean(),
      level: v.string(), // A1..C2
      xp: v.number(),
      streak: v.number(),
      lastActivity: v.optional(v.number()),
    })
      .index("by_user", ["userId"])
      .index("by_user_language", ["userId", "language"]),

    srsCards: defineTable({
      userId: v.id("users"),
      language: v.union(
        v.literal("en"),
        v.literal("zh"),
        v.literal("es"),
        v.literal("ar"),
        v.literal("ru"),
        v.literal("sw"),
        v.literal("ln"),
        v.literal("ha"),
        v.literal("yo"),
        v.literal("zu"),
        v.literal("wo"),
      ),
      slangId: v.id("slangExpressions"),
      easeFactor: v.number(),
      intervalDays: v.number(),
      repetitions: v.number(),
      nextReview: v.number(),
      lastReview: v.optional(v.number()),
      createdAt: v.number(),
      // Dénormalisé depuis slangExpressions à la création (addToSrs) :
      // permet à getMasteryData de regrouper par registre sans relire la
      // table slang (anti-quota R6). Backfill idempotent possible.
      register: v.optional(v.string()),
      // Machine à états SRS : new | learning | confirming | mastered.
      status: v.optional(
        v.union(
          v.literal("new"),
          v.literal("learning"),
          v.literal("confirming"),
          v.literal("mastered"),
        ),
      ),
      // Prochaine revue ; null = carte maîtrisée, plus jamais proposée.
      due: v.optional(v.union(v.number(), v.null())),
      consecutiveFails: v.optional(v.number()),
      lastRating: v.optional(
        v.union(
          v.literal("again"),
          v.literal("hard"),
          v.literal("good"),
          v.literal("easy"),
          v.null(),
        ),
      ),
      // Jour (epoch ms du début de journée UTC) de première sortie du deck.
      firstSeenAt: v.optional(v.number()),
    })
      .index("by_user", ["userId"])
      .index("by_user_language", ["userId", "language"])
      .index("by_user_slang", ["userId", "slangId"]),

    learningSessions: defineTable({
      userId: v.id("users"),
      language: v.union(
        v.literal("en"),
        v.literal("zh"),
        v.literal("es"),
        v.literal("ar"),
        v.literal("ru"),
        v.literal("sw"),
        v.literal("ln"),
        v.literal("ha"),
        v.literal("yo"),
        v.literal("zu"),
        v.literal("wo"),
      ),
      kind: v.string(), // shadowing | srs | discovery | sleep
      durationSeconds: v.optional(v.number()),
      itemsLearned: v.number(),
      completedAt: v.number(),
    }).index("by_user", ["userId"]),

    /**
     * Objectifs d'apprentissage (dashboard Analytics).
     * « current » n'est JAMAIS stocké : il est recalculé à chaque lecture
     * depuis le nombre réel de cartes SRS de la langue (anti-désyncro).
     * language = un des codes d'apprentissage, ou "total" (toutes langues).
     */
    goals: defineTable({
      userId: v.id("users"),
      language: v.union(
        v.literal("en"),
        v.literal("zh"),
        v.literal("es"),
        v.literal("ar"),
        v.literal("ru"),
        v.literal("sw"),
        v.literal("ln"),
        v.literal("ha"),
        v.literal("yo"),
        v.literal("zu"),
        v.literal("wo"),
        v.literal("total"),
      ),
      target: v.number(),
      deadline: v.optional(v.number()), // epoch ms
      origin: v.union(v.literal("suggested"), v.literal("custom")),
      archived: v.boolean(),
    }).index("by_user", ["userId"]),

    /**
     * Favoris d'expressions (§34). Distinct du deck SRS à dessein :
     * un cœur range sans programmer de révision, « Apprendre » programme.
     */
    slangFavorites: defineTable({
      userId: v.id("users"),
      slangId: v.id("slangExpressions"),
      addedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_slang", ["userId", "slangId"]),

    userMedia: defineTable({
      userId: v.id("users"),
      language: v.union(
        v.literal("en"),
        v.literal("zh"),
        v.literal("es"),
        v.literal("ar"),
        v.literal("ru"),
        v.literal("sw"),
        v.literal("ln"),
        v.literal("ha"),
        v.literal("yo"),
        v.literal("zu"),
        v.literal("wo"),
      ),
      title: v.string(),
      sourceName: v.string(),
      mediaType: v.string(), // video | audio
      // Absent for URL-based media (e.g. YouTube links).
      storageId: v.optional(v.id("_storage")),
      // Original URL for link-based media (YouTube…).
      sourceUrl: v.optional(v.string()),
      // Platform key from the media resolver (youtube | tiktok | vimeo | …).
      // Absent for uploads and pasted text.
      platform: v.optional(v.string()),
      // Language subtitles are translated into (defaults to "fr").
      targetLanguage: v.optional(
        v.union(
          v.literal("en"),
          v.literal("fr"),
          v.literal("zh"),
          v.literal("es"),
          v.literal("ar"),
          v.literal("ru"),
          v.literal("sw"),
          v.literal("ln"),
          v.literal("ha"),
          v.literal("yo"),
          v.literal("zu"),
          v.literal("wo"),
        ),
      ),
      // Where the transcript came from: youtube_subtitles |
      // faster_whisper_local | groq_whisper | pasted_text | {platform}_embed_only
      transcriptSource: v.optional(v.string()),
      status: v.string(), // pending | processing | completed | failed
      error: v.optional(v.string()),
      // Failure taxonomy so the UI can offer the right recovery path instead
      // of a dead-end: no_transcript | rate_limited | timeout | missing_key |
      // groq_error | unsupported_platform | internal
      errorKind: v.optional(v.string()),
      transcription: v.optional(v.string()),
      translation: v.optional(v.string()),
      // Text media pasted by the user (mediaType "text") — the transcript IS
      // the text, no transcription engine involved.
      textContent: v.optional(v.string()),
      // True when every translation provider failed and subtitles keep the
      // original text — shown as a discreet notice in the UI.
      translationFailed: v.optional(v.boolean()),
      // Coarse translation progress (0-100), published per batch so the UI
      // tracker visibly moves during the longest stage.
      translationProgress: v.optional(v.number()),
      // Total transcript segment count, published with checkpoint 1 so the
      // UI can display « x/y segments » during translation.
      segmentCount: v.optional(v.number()),
      subtitles: v.optional(v.array(subtitleValidator)),
      slangDetected: v.optional(v.array(slangHitValidator)),
      durationSeconds: v.optional(v.number()),
    }).index("by_user", ["userId"]),

    // Jobs de transcription longue : découpe en chunks > 25 Mo, progression
    // live (doneChunks/totalChunks), warning par chunk indécodable, segments
    // fusionnés écrits à la fin pour consommation réactive par l'UI.
    mediaJobs: defineTable({
      userId: v.id("users"),
      title: v.string(),
      sourceUrl: v.string(),
      // pending | chunking | transcribing | translating | completed | failed
      status: v.string(),
      totalChunks: v.optional(v.number()),
      doneChunks: v.optional(v.number()),
      currentStep: v.optional(v.string()), // clé i18n du libellé d'étape
      warning: v.optional(v.string()),
      segments: v.optional(v.array(subtitleValidator)),
      // Média créé une fois la transcription prête (nav UI réactive).
      mediaId: v.optional(v.id("userMedia")),
      // Transcripts par chunk déjà réussis — un « Réessayer » ne re-transcrit
      // que les chunks manquants (équivalent serveur d'un cache local).
      chunkCache: v.optional(
        v.array(
          v.object({
            i: v.number(),
            segments: v.array(
              v.object({ start: v.number(), end: v.number(), text: v.string() }),
            ),
            lang: v.optional(v.string()),
          }),
        ),
      ),
      error: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    /* ═══════════════════════════════════════════════════════════════
       OPENVERSE MEDIA — moteur universel de recherche et de
       consultation de contenus. Tables préfixées `ov` pour rester
       isolées et remplaçables module par module.
       ═══════════════════════════════════════════════════════════════ */

    /** Registre des connecteurs (miroir de src/convex/ovSources.ts). */
    ovSources: defineTable({
      key: v.string(),
      name: v.string(),
      kind: v.string(), // metadata | content | index | dataset
      category: v.string(),
      homepage: v.string(),
      docsUrl: v.optional(v.string()),
      license: v.string(),
      requiresEnv: v.array(v.string()),
      searchEnabled: v.boolean(),
      streamingAllowed: v.boolean(),
      notes: v.optional(v.string()),
      active: v.boolean(),
      lastError: v.optional(v.string()),
      lastCheckedAt: v.optional(v.number()),
    }).index("by_key", ["key"]),

    /** Catalogue de licences (source de vérité du Rights Engine). */
    ovLicenses: defineTable({
      code: v.string(),
      name: v.string(),
      url: v.string(),
      commercialUseAllowed: v.boolean(),
      derivativeWorkAllowed: v.boolean(),
      shareAlike: v.boolean(),
      attributionRequired: v.boolean(),
      translationAllowed: v.boolean(),
      redistributionAllowed: v.boolean(),
    }).index("by_code", ["code"]),

    /** Contenus indexés (métadonnées + décision de droits courante). */
    ovContents: defineTable({
      key: v.string(), // `${source}:${externalId}`
      source: v.string(),
      externalId: v.string(),
      kind: v.string(), // movie | series | video | music | podcast | audio | book | article | social | image
      title: v.string(),
      creator: v.optional(v.string()),
      year: v.optional(v.number()),
      language: v.optional(v.string()),
      duration: v.optional(v.number()),
      genres: v.optional(v.array(v.string())),
      description: v.optional(v.string()),
      thumbnail: v.optional(v.string()),
      rating: v.optional(v.number()),
      /* ── Fraîcheur & facettes (Nouveautés / Tendances / Par pays) ──
         Ces champs rendent possible le tri par actualité : sans eux, un
         moteur de contenus ne peut proposer que du patrimoine. */
      country: v.optional(v.string()), // ISO 3166-1 alpha-2
      releaseDate: v.optional(v.number()), // publication d'origine (epoch ms)
      publishedAt: v.optional(v.number()), // date exploitable pour le tri « récent »
      lastUpdatedAt: v.optional(v.number()), // dernière mise à jour côté source
      popularity: v.optional(v.number()), // score de popularité fourni par la source
      freshness: v.optional(v.number()), // 0-100, recalculé à chaque indexation
      mediaFormat: v.optional(v.string()), // mp3 | hls | rss | epub | pdf | text | embed…
      creatorKind: v.optional(v.string()), // creator | label | studio | publisher | broadcaster | institution | aggregator
      externalUrl: v.string(),
      streamUrl: v.optional(v.string()),
      previewUrl: v.optional(v.string()),
      embedUrl: v.optional(v.string()),
      textUrl: v.optional(v.string()),
      /** Corps de texte court déjà récupéré (article sous licence libre). */
      body: v.optional(v.string()),
      rssUrl: v.optional(v.string()),
      attribution: v.optional(v.string()),
      rightsStatus: v.string(),
      licenseCode: v.optional(v.string()),
      licenseName: v.optional(v.string()),
      /* ── Droits : tout ce que le Rights Engine a le droit de faire ── */
      attributionRequired: v.optional(v.boolean()),
      territory: v.optional(v.string()), // WORLD par défaut, sinon ISO 3166-1
      expiresAt: v.optional(v.number()), // fin des droits négociés (epoch ms)
      commercialUseAllowed: v.boolean(),
      fullStreamAllowed: v.boolean(),
      downloadAllowed: v.boolean(),
      hostingAllowed: v.boolean(),
      translationAllowed: v.boolean(),
      derivativeWorkAllowed: v.boolean(),
      rightsSource: v.optional(v.string()), // connector | admin
      rightsReviewedBy: v.optional(v.id("users")),
      rightsReviewedAt: v.optional(v.number()),
      blockedReason: v.optional(v.string()),
      decisionLabels: v.optional(v.array(v.string())),
      searchCount: v.number(),
      lastSeenAt: v.number(),
      createdAt: v.number(),
    })
      .index("by_key", ["key"])
      .index("by_title", ["title"])
      .index("by_kind", ["kind"])
      .index("by_kind_seen", ["kind", "lastSeenAt"])
      .index("by_seen", ["lastSeenAt"])
      .index("by_rights", ["rightsStatus"])
      .index("by_source", ["source"])
      // Tri par actualité : Nouveautés / Récent.
      .index("by_published", ["publishedAt"])
      .index("by_kind_published", ["kind", "publishedAt"])
      // Facettes « Par pays » / « Par langue ».
      .index("by_kind_country", ["kind", "country"])
      .index("by_kind_language", ["kind", "language"]),

    /** Artistes, auteurs, réalisateurs, acteurs. */
    ovPeople: defineTable({
      name: v.string(),
      role: v.string(), // movie | music | book | audio | image
      source: v.optional(v.string()),
      externalId: v.optional(v.string()),
      contentKey: v.optional(v.string()),
      appearances: v.optional(v.number()),
      lastSeenAt: v.number(),
    })
      .index("by_name_role", ["name", "role"])
      .index("by_content", ["contentKey"]),

    /** Transcriptions : segments horodatés (srt/vtt générés à la volée). */
    ovTranscriptions: defineTable({
      userId: v.id("users"),
      contentKey: v.string(),
      engine: v.string(), // source_text | local_whisper | groq_whisper | unavailable
      language: v.optional(v.string()),
      status: v.string(), // queued | processing | done | error | blocked
      progress: v.optional(v.number()),
      step: v.optional(v.string()),
      segments: v.optional(v.array(segmentValidator)),
      text: v.optional(v.string()),
      error: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_content", ["userId", "contentKey"]),

    /** Traductions d'une transcription, segment par segment. */
    ovTranslations: defineTable({
      userId: v.id("users"),
      transcriptionId: v.id("ovTranscriptions"),
      targetLang: v.string(),
      engine: v.string(),
      status: v.string(),
      segments: v.optional(
        v.array(
          v.object({ start: v.number(), end: v.number(), source: v.string(), text: v.string() }),
        ),
      ),
      error: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_transcription", ["transcriptionId"])
      .index("by_user", ["userId"]),

    /** Sous-titres exportés (.srt / .vtt) conservés pour relecture. */
    ovSubtitles: defineTable({
      userId: v.id("users"),
      contentKey: v.string(),
      format: v.string(), // srt | vtt
      lang: v.string(),
      body: v.string(),
      createdAt: v.number(),
    }).index("by_user_content", ["userId", "contentKey"]),

    ovFavorites: defineTable({
      userId: v.id("users"),
      contentKey: v.string(),
      kind: v.string(),
      title: v.string(),
      creator: v.optional(v.string()),
      thumbnail: v.optional(v.string()),
      externalUrl: v.string(),
      rightsStatus: v.string(),
      hostingAllowed: v.boolean(),
      addedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_content", ["userId", "contentKey"]),

    ovHistory: defineTable({
      userId: v.id("users"),
      contentKey: v.string(),
      kind: v.string(),
      title: v.string(),
      creator: v.optional(v.string()),
      thumbnail: v.optional(v.string()),
      externalUrl: v.string(),
      rightsStatus: v.string(),
      hostingAllowed: v.boolean(),
      position: v.number(),
      duration: v.optional(v.number()),
      progress: v.number(),
      completed: v.optional(v.boolean()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_content", ["userId", "contentKey"]),

    /* ═══════════════════════════════════════════════════════════════
       GAMIFICATION (Phase 2/4) — XP global, niveaux, streaks, badges,
       historique de quiz. Une ligne userStats par utilisateur.
       ═══════════════════════════════════════════════════════════════ */

    /** Agrégats de gamification de l'utilisateur (1 ligne, upsert). */
    userStats: defineTable({
      userId: v.id("users"),
      totalXP: v.number(),
      level: v.number(),
      currentStreak: v.number(),
      longestStreak: v.number(),
      lastActiveAt: v.number(),
      badges: v.array(v.string()),
      /** Loss aversion — XP decay : début de la période d'inactivité (null = actif). */
      decayStartAt: v.optional(v.union(v.number(), v.null())),
      /** Dernier usage d'un Streak Freeze (anti double-dépense même jour). */
      lastFreezeAt: v.optional(v.number()),
      /** Monnaie premium (achats Freeze). */
      gems: v.optional(v.number()),
      /** Horodatage de la dernière session Last Chance réussie. */
      lastChanceUsedAt: v.optional(v.number()),
      /** MOD 2 — historique gems (10 dernières entrées). */
      gemsHistory: v.optional(
        v.array(
          v.object({
            delta: v.number(),
            reason: v.string(),
            balance: v.number(),
            at: v.number(),
          }),
        ),
      ),
      /** MOD 2 — tokens « Révéler 1 réponse de quiz ». */
      revealTokens: v.optional(v.number()),
      /** MOD 2 — Double XP actif jusqu'à ce timestamp (0 = inactif). */
      doubleXpUntil: v.optional(v.number()),
      /** MOD 2 — paliers de streak déjà crédités (indices STREAK_GEM_TIERS). */
      streakXPed: v.optional(v.array(v.number())),
      /** MOD 3 — dernière complétion du défi quotidien (anti-farm). */
      lastDailyAt: v.optional(v.number()),
      /** MOD 4 — ligue courante et statut de promotion à afficher une fois. */
      currentLeague: v.optional(
        v.union(
          v.literal("bronze"),
          v.literal("silver"),
          v.literal("gold"),
          v.literal("platinum"),
          v.literal("diamond"),
        ),
      ),
      lastLeagueWeek: v.optional(v.string()),
      pendingPromotion: v.optional(
        v.object({
          from: v.union(
            v.literal("bronze"),
            v.literal("silver"),
            v.literal("gold"),
            v.literal("platinum"),
            v.literal("diamond"),
          ),
          to: v.union(
            v.literal("bronze"),
            v.literal("silver"),
            v.literal("gold"),
            v.literal("platinum"),
            v.literal("diamond"),
          ),
          weekKey: v.string(),
        }),
      ),
    }).index("by_user", ["userId"]),

    /** MOD 2 — Loot boxes : récompenses variables (Skinner box).
     *  openedAt = null → non ouverte (visible au centre loot du store). */
    userLootBoxes: defineTable({
      userId: v.id("users"),
      tier: v.union(v.literal("common"), v.literal("rare"), v.literal("epic")),
      contents: v.object({
        gems: v.number(),
        badgeId: v.optional(v.string()),
        avatarToken: v.optional(v.boolean()),
      }),
      openedAt: v.optional(v.union(v.number(), v.null())),
      source: v.optional(v.string()),
    }).index("by_user", ["userId"]),

    /** MOD 3 — micro-défi quotidien, une ligne par utilisateur et jour. */
    dailyChallenges: defineTable({
      userId: v.optional(v.id("users")),
      dayKey: v.string(),
      type: v.union(v.literal("quiz"), v.literal("mcq"), v.literal("listen")),
      payload: v.object({
        slangId: v.id("slangExpressions"),
        question: v.string(),
        options: v.array(v.string()),
        answerIndex: v.number(),
        language: v.string(),
        expression: v.string(),
      }),
      expiresAt: v.number(),
      completedAt: v.optional(v.union(v.number(), v.null())),
    })
      .index("by_day", ["dayKey"])
      .index("by_user_day", ["userId", "dayKey"]),

    /** MOD 6 — catalogue statique de personnalisation (85 items). */
    customizationCatalog: defineTable({
      itemId: v.string(),
      type: v.union(
        v.literal("avatar"),
        v.literal("hat"),
        v.literal("glasses"),
        v.literal("background"),
      ),
      name: v.string(),
      description: v.string(),
      rarity: v.union(
        v.literal("common"),
        v.literal("rare"),
        v.literal("epic"),
        v.literal("legendary"),
      ),
      priceGems: v.number(),
      achievementId: v.optional(v.string()),
      previewUrl: v.string(),
      nameTranslations: v.optional(v.record(v.string(), v.string())),
      descriptionTranslations: v.optional(v.record(v.string(), v.string())),
    })
      .index("by_type", ["type"])
      .index("by_item", ["itemId"]),

    /** MOD 6 — sélection et collection de personnalisation, une ligne/user. */
    userCustomization: defineTable({
      userId: v.id("users"),
      selectedAvatar: v.string(),
      selectedHat: v.optional(v.string()),
      selectedGlasses: v.optional(v.string()),
      selectedBackground: v.optional(v.string()),
      /** Avatar 3D créé dans le studio Ready Player Me : URL .glb servie
          par le CDN public de la plateforme. Absent = on garde l'emoji. */
      rpmAvatarUrl: v.optional(v.string()),
      unlocked: v.array(v.string()),
    })
      .index("by_user", ["userId"]),

    /** Tier 3 — parrainage viral, une ligne par filleul attribué. */
    referrals: defineTable({
      referrerId: v.id("users"),
      referredId: v.id("users"),
      createdAt: v.number(),
      rewarded: v.boolean(),
      rewardedAt: v.optional(v.number()),
    })
      .index("by_referrer", ["referrerId"])
      .index("by_referred", ["referredId"]),

    /** MOD 3 — centre de notifications in-app. */
    userNotifications: defineTable({
      userId: v.id("users"),
      kind: v.union(
        v.literal("streak"),
        v.literal("loot"),
        v.literal("record"),
        v.literal("achievement"),
      ),
      title: v.string(),
      body: v.string(),
      readAt: v.optional(v.union(v.number(), v.null())),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    /** MOD 5 — catalogue public de 150 succès granulaires. */
    achievements: defineTable({
      achievementId: v.string(),
      category: v.union(
        v.literal("lang"),
        v.literal("streak"),
        v.literal("quiz"),
        v.literal("conv"),
        v.literal("explore"),
        v.literal("collect"),
      ),
      title: v.string(),
      description: v.string(),
      target: v.number(),
      reward: v.object({
        xp: v.number(),
        gems: v.number(),
        badgeId: v.optional(v.string()),
      }),
      icon: v.string(),
      tier: v.union(v.literal("bronze"), v.literal("silver"), v.literal("gold")),
      metric: v.string(),
      titleTranslations: v.optional(v.record(v.string(), v.string())),
      descriptionTranslations: v.optional(v.record(v.string(), v.string())),
    }).index("by_slug", ["achievementId"]),

    /** MOD 5 — progression utilisateur, une ligne par succès. */
    userAchievements: defineTable({
      userId: v.id("users"),
      achievementId: v.string(),
      progress: v.number(),
      completed: v.boolean(),
      completedAt: v.union(v.number(), v.null()),
      lastReminderProgress: v.optional(v.number()),
    })
      .index("by_user", ["userId"])
      .index("by_user_achievement", ["userId", "achievementId"]),

    /** Compteurs d'activité, uniquement des mutations métier. */
    achievementCounters: defineTable({
      userId: v.id("users"),
      metric: v.string(),
      count: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_metric", ["userId", "metric"]),

    /** MOD 4 — XP credited by the single applyAward writer, one row/user/week. */
    weeklyXp: defineTable({
      userId: v.id("users"),
      weekKey: v.string(), // ISO 8601, e.g. 2026-W39
      xp: v.number(),
      updatedAt: v.number(),
    })
      .index("by_week", ["weekKey"])
      .index("by_user_week", ["userId", "weekKey"]),

    /** MOD 4 — final weekly ranking and league decision, one row/user/week. */
    weeklyLeaderboard: defineTable({
      weekKey: v.string(), // ISO 8601, e.g. 2026-W39
      userId: v.id("users"),
      xp: v.number(),
      rank: v.number(),
      league: v.union(
        v.literal("bronze"),
        v.literal("silver"),
        v.literal("gold"),
        v.literal("platinum"),
        v.literal("diamond"),
      ),
      previousRank: v.optional(v.number()),
      rankDelta: v.optional(v.number()),
      resultingLeague: v.optional(
        v.union(
          v.literal("bronze"),
          v.literal("silver"),
          v.literal("gold"),
          v.literal("platinum"),
          v.literal("diamond"),
        ),
      ),
      processedAt: v.number(),
    })
      .index("by_week_rank", ["weekKey", "rank"])
      .index("by_user_week", ["userId", "weekKey"]),

    /** Streak Freeze — chaque utilisateur possède au plus une ligne. */
    userFreezes: defineTable({
      userId: v.id("users"),
      count: v.number(),
      lastUsed: v.optional(v.number()),
    }).index("by_user", ["userId"]),

    /** 1 ligne par quiz soumis (jour ISO UTC = clé d'agrégation du dashboard). */
    quizHistory: defineTable({
      userId: v.id("users"),
      date: v.string(), // ISO YYYY-MM-DD (UTC)
      language: v.string(),
      questionsAnswered: v.number(),
      correctAnswers: v.number(),
      xpEarned: v.number(),
      questionTypes: v.array(v.string()),
    })
      .index("by_user_date", ["userId", "date"])
      .index("by_user", ["userId"]),

    /**
     * Session de quiz en cours. Les questions COMPLETS (avec correctIndex)
     * vivent côté serveur : le client ne reçoit jamais la bonne réponse
     * (anti-triche sans crypto). userId optionnel = sessions CLI/anonymes.
     */
    quizSessions: defineTable({
      userId: v.optional(v.id("users")),
      language: v.string(),
      questions: v.array(quizStoredQuestionValidator),
      createdAt: v.number(),
      completed: v.boolean(),
      score: v.optional(v.number()), // % — rempli à la soumission
      xpEarned: v.optional(v.number()),
    }).index("by_user", ["userId"]),

    /* ═══════════════════════════════════════════════════════════════
       CONVERSATION IA (Phase 3/4) — personnages immersifs, scénarios
       contextuels, correction en temps réel (Groq, cascade models).
       ═══════════════════════════════════════════════════════════════ */

    /** Correction inline d'une erreur de l'utilisateur. */
    aiConversations: defineTable({
      userId: v.id("users"),
      characterId: v.string(),
      scenarioId: v.string(),
      language: v.string(),
      messages: v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
          timestamp: v.number(),
          corrections: v.optional(
            v.array(
              v.object({
                wrong: v.string(),
                right: v.string(),
                note: v.optional(v.string()),
              }),
            ),
          ),
        }),
      ),
      startedAt: v.number(),
      endedAt: v.optional(v.number()),
      xpEarned: v.number(),
      expressionsUsed: v.array(v.string()),
      status: v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("abandoned"),
      ),
      /** Objectifs du scénario pour CETTE conversation (checklist UI). */
      objectives: v.array(
        v.object({ expression: v.string(), done: v.boolean() }),
      ),
      /** 1.3 — mode libre : base slang vide ⇒ objectifs = [] (UI informée). */
      freeMode: v.optional(v.boolean()),
      /** Score qualité cumulé (moyenne des tours, 0-100). */
      qualitySum: v.number(),
      qualityCount: v.number(),
      /** Échantillon de la base slang de la langue (matching local). */
      pool: v.array(
        v.object({
          expression: v.string(),
          meaning: v.string(),
          example: v.optional(v.string()),
        }),
      ),
    }).index("by_user", ["userId"]),

    /** Personnages immersifs (seed idempotent, contenu statique). */
    aiCharacters: defineTable({
      id: v.string(),
      name: v.string(),
      description: v.string(),
      personality: v.string(),
      avatar: v.string(),
      language: v.string(),
      register: v.string(),
    })
      .index("by_language", ["language"])
      .index("by_char_id", ["id"]),

    /** Scénarios contextuels (objectifs = expressions à utiliser). */
    aiScenarios: defineTable({
      id: v.string(),
      characterId: v.string(),
      language: v.string(),
      title: v.string(),
      description: v.string(),
      context: v.string(),
      opening: v.string(),
      objectives: v.array(v.string()),
      difficulty: v.union(
        v.literal("beginner"),
        v.literal("intermediate"),
        v.literal("advanced"),
      ),
    }).index("by_language", ["language"]),

    /** Cache des réponses IA (1 h) — limite les coûts Groq. */
    aiChatCache: defineTable({
      key: v.string(),
      reply: v.string(),
      createdAt: v.number(),
      expiresAt: v.number(),
    }).index("by_key", ["key"]),

    /* ═══════════════════════════════════════════════════════════════
       PONTS CULTURELS (Phase 4/4) — un même concept, plusieurs langues.
       Données fournies (seed verbatim), upsert idempotent par slug.
       ═══════════════════════════════════════════════════════════════ */

    /**
     * Concept inter-langues : « sapa » (yo) ≈ « broke » (en) ≈ « fauché » (fr).
     * slug = clé unique ; entries = traductions argotiques par langue.
     */
    crossConcepts: defineTable({
      slug: v.string(),
      labelFr: v.string(),
      labelEn: v.string(),
      entries: v.array(
        v.object({
          lang: v.string(),
          expr: v.string(),
          gloss: v.string(),
        }),
      ),
    }).index("by_slug", ["slug"]),

    ovBookmarks: defineTable({
      userId: v.id("users"),
      contentKey: v.string(),
      kind: v.string(),
      title: v.string(),
      thumbnail: v.optional(v.string()),
      externalUrl: v.string(),
      rightsStatus: v.string(),
      hostingAllowed: v.boolean(),
      label: v.string(),
      position: v.number(),
      note: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_content", ["userId", "contentKey"]),

    ovPlaylists: defineTable({
      userId: v.id("users"),
      name: v.string(),
      kind: v.string(), // playlist | collection
      description: v.optional(v.string()),
      items: v.array(
        v.object({
          contentKey: v.string(),
          kind: v.string(),
          title: v.string(),
          creator: v.optional(v.string()),
          thumbnail: v.optional(v.string()),
          externalUrl: v.string(),
          rightsStatus: v.string(),
          hostingAllowed: v.boolean(),
        }),
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    ovCollections: defineTable({
      userId: v.id("users"),
      name: v.string(),
      description: v.optional(v.string()),
      contentKeys: v.array(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    ovSearchHistory: defineTable({
      userId: v.optional(v.id("users")),
      query: v.string(),
      lang: v.optional(v.string()),
      resultCount: v.number(),
      sources: v.optional(v.array(v.string())),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_query", ["query"]),

    /** Réponses des sources lentes (30 min) : requête massive = 1 seul
        appel par source, puis lecture instantanée pour tout le monde. */
    ovSourceCache: defineTable({
      cacheKey: v.string(),
      payload: v.array(v.string()),
      createdAt: v.number(),
    }).index("by_key", ["cacheKey"]),

    ovPreferences: defineTable({
      userId: v.id("users"),
      uiLang: v.optional(v.string()),
      translationLang: v.optional(v.string()),
      subtitleLang: v.optional(v.string()),
      autoplay: v.optional(v.boolean()),
      dataSaver: v.optional(v.boolean()),
      safeSearch: v.optional(v.boolean()),
      preferLocalEngines: v.optional(v.boolean()),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    /** Journal d'audit des décisions de droits (traçabilité juridique). */
    ovRightsLedger: defineTable({
      contentKey: v.string(),
      source: v.string(),
      rightsStatus: v.string(),
      mode: v.string(),
      reasons: v.array(v.string()),
      actor: v.optional(v.id("users")),
      createdAt: v.number(),
    }).index("by_content", ["contentKey"]),

    /** Erreurs connecteurs, alertes droits, événements système. */
    ovLogs: defineTable({
      level: v.string(), // info | warn | error
      scope: v.string(), // rights | connector | studio | security
      message: v.string(),
      meta: v.optional(v.string()),
      userId: v.optional(v.id("users")),
      createdAt: v.number(),
    })
      .index("by_scope", ["scope"])
      .index("by_level", ["level"])
      .index("by_created", ["createdAt"]),

    /* ═══════════════════════════════════════════════════════════════
       ABONNEMENTS PREMIUM (Lemon Squeezy — lot « paiement »)

       `isPremium` n'est JAMAIS stocké : il se déduit de `status` +
       `currentPeriodEnd` dans `subscriptions.premiumStatusFor`, l'unique
       source de vérité. L'écriture se fait par UPSERT sur
       `lemonSqueezySubscriptionId` (Lemon Squeezy est la seule autorité
       sur le statut), donc le rejeu d'un webhook écrase la même ligne.
       ═══════════════════════════════════════════════════════════════ */
    subscriptions: defineTable({
      /** Compte Kilingo concerné. */
      userId: v.id("users"),
      /** Statut NORMALISÉ — les cinq seuls états que la table connaît. */
      status: v.union(
        v.literal("active"),
        v.literal("cancelled"),
        v.literal("past_due"),
        v.literal("trialing"),
        v.literal("expired"),
      ),
      /** Statut BRUT de l'API (`on_trial`, `unpaid`, `paused`…). */
      lemonSqueezyStatus: v.string(),
      /** Identifiant d'abonnement chez Lemon Squeezy — la clé d'upsert. */
      lemonSqueezySubscriptionId: v.string(),
      /** Client Lemon Squeezy (permet la réconciliation par e-mail). */
      lemonSqueezyCustomerId: v.optional(v.string()),
      /** Variante achetée — utile le jour où Premium a plusieurs offres. */
      variantId: v.optional(v.string()),
      /** Fin de la période en cours, en ms epoch (absent = indéterminé). */
      currentPeriodEnd: v.optional(v.number()),
      /** Fin de l'essai gratuit, en ms epoch. */
      trialEndsAt: v.optional(v.number()),
      /** E-mail de l'abonné — réconciliation si `custom.user_id` manque. */
      email: v.optional(v.string()),
      /** Abonnement créé en mode test : il ne vaut pas argent réel. */
      testMode: v.optional(v.boolean()),
      /** `updated_at` de l'API, en ms — garde l'idempotence ordonnée. */
      lemonSqueezyUpdatedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_lemon_subscription", ["lemonSqueezySubscriptionId"])
      .index("by_lemon_customer", ["lemonSqueezyCustomerId"]),

    /* Webhooks traités (idempotence) — empreinte SHA-256 du corps BRUT. */
    lemonSqueezyWebhookEvents: defineTable({
      key: v.string(),
      eventName: v.string(),
      resourceType: v.optional(v.string()),
      resourceId: v.optional(v.string()),
      resolved: v.boolean(),
      duplicate: v.optional(v.boolean()),
      receivedAt: v.number(),
    }).index("by_key", ["key"]),

    /* Provider résolu (table-singleton) — l'état de configuration transite
       par ici car une query Convex ne peut pas lire `process.env`. */
    lemonSqueezyProvider: defineTable({
      key: v.string(),
      storeId: v.optional(v.string()),
      variantId: v.optional(v.string()),
      productName: v.optional(v.string()),
      priceCents: v.optional(v.number()),
      hasApiKey: v.optional(v.boolean()),
      hasWebhookSecret: v.optional(v.boolean()),
      ready: v.optional(v.boolean()),
      reason: v.optional(v.string()),
      testMode: v.optional(v.boolean()),
      resolvedAt: v.number(),
    }).index("by_key", ["key"]),

    /* Quota Shadow quotidien (Module B) — une ligne par compte et par JOUR
       LOCAL du compte ; compteur et non booléen, pour afficher le reste
       avant que le plafond ne tombe. */
    shadowQuota: defineTable({
      key: v.string(), // `${userId}:${yyyy-mm-dd}` dans le fuseau du compte
      userId: v.id("users"),
      day: v.string(),
      timezone: v.string(),
      used: v.number(),
      updatedAt: v.number(),
    })
      .index("by_key", ["key"])
      .index("by_user", ["userId"]),

    /* Langue des signes (LSF) — progression d'un compte, une ligne par
       signe ; le catalogue vit dans `src/data/lsf-signs.json`. */
    lsfSignProgress: defineTable({
      key: v.string(), // `${userId}:${signId}`
      userId: v.id("users"),
      signKey: v.string(),
      seen: v.boolean(),
      right: v.number(),
      wrong: v.number(),
      updatedAt: v.number(),
    })
      .index("by_key", ["key"])
      .index("by_user", ["userId"]),

    /* Langue des signes — signalements de la communauté (gloss à valider). */
    lsfSignReports: defineTable({
      signKey: v.string(),
      gloss: v.string(),
      userId: v.id("users"),
      reason: v.string(),
      note: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_sign", ["signKey"])
      .index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
