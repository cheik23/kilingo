import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { rightsStatusValidator } from "./ovRights";
import { ROLES } from "./schema";
import type { Doc, Id } from "./_generated/dataModel";

/* ═══════════════════════════════════════════════════════════════════════
   OPENVERSE MEDIA — ADMINISTRATION
   Contenus, sources, licences, droits, erreurs, utilisateurs, alertes.
   Réservé aux comptes dont le rôle est `admin`.
   ═══════════════════════════════════════════════════════════════════════ */

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Connexion requise.");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== ROLES.ADMIN) {
    throw new Error("Accès réservé à l'administration.");
  }
  return userId;
}

/* ── Amorçage administrateur (P0.2) ───────────────────────────────────
   Avant : « le premier compte connecté peut revendiquer l'administration ».
   Sur un déploiement joignable, ce premier compte pouvait être n'importe qui
   (inscription libre) : l'attaquant le plus rapide héritait de `setRole`, du
   tableau de bord et de la revue des droits. Le contrôle d'unicité lisait en
   plus les 200 premiers documents `users` — un administrateur au-delà de
   cette fenêtre était invisible, donc le compte suivant pouvait s'élever.

   Décision : PLUS AUCUNE VOIE DANS L'APPLICATION. Le premier administrateur
   est créé par l'exploitation, avec la clé admin du déploiement :

     npx convex run internal.ovAdmin.bootstrapAdmin '{"email":"vous@exemple.tld"}'
     npx convex run internal.ovAdmin.bootstrapAdmin '{"userId":"<id users>"}'

   Pourquoi ce canal plutôt qu'un bouton réservé à un email : c'est celui des
   autres opérations de maintenance du dépôt (`internal.slang.seed`,
   `internal.crossSeed.seedCrossConcepts`). Il ne demande AUCUN nouveau
   secret, aucune variable d'environnement, et une fonction interne n'est
   pas adressable par le client. Quiconque détient la clé admin peut déjà
   lire et écrire la base : cette mutation ne lui donne donc aucun privilège
   nouveau, alors qu'un bouton public en donnait à tout le monde.

   Le compte visé est désigné EXPLICITEMENT (email résolu par l'index
   `email`, ou identifiant) : jamais déduit de l'appelant, donc jamais choisi
   par le client. Un compte anonyme est refusé. Si un administrateur existe
   déjà, l'appel est refusé — sauf s'il vise ce même administrateur
   (idempotence pour un script rejoué).
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Borne du balayage de repli par email — une opération d'exploitation rare,
 * jamais un chemin client. Au-delà, l'exploitant passe par `userId`.
 */
const BOOTSTRAP_SCAN_LIMIT = 200;

/** Un administrateur existe-t-il ? Lecture indexée, bornée à un document. */
async function anyAdminExists(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const rows = await ctx.db
    .query("users")
    .withIndex("role", (q) => q.eq("role", ROLES.ADMIN))
    .take(1);
  return rows.length > 0;
}

export const amIAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { admin: false };
    const user = await ctx.db.get(userId);
    return { admin: user?.role === ROLES.ADMIN };
  },
});

/**
 * Compte visé par l'amorçage : identifiant (chemin exact) ou email.
 *
 * L'index `email` est sensible à la casse : on cherche d'abord l'email tel
 * quel, puis sa variante en minuscules, puis — en dernier recours — un
 * balayage BORNÉ et insensible à la casse. Un balayage qui trouve plusieurs
 * comptes ne devine pas : il refuse et demande l'identifiant. Le pire cas
 * est donc « compte introuvable » (jamais « mauvais compte promu »).
 */
async function resolveBootstrapTarget(
  ctx: MutationCtx,
  args: { email?: string; userId?: Id<"users"> },
): Promise<Doc<"users"> | null> {
  if (args.userId !== undefined) return await ctx.db.get(args.userId);
  const raw = args.email?.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  // Toutes les correspondances sont RASSEMBLÉES avant de décider : deux
  // comptes qui ne diffèrent que par la casse doivent faire ÉCHOUER l'appel,
  // pas laisser la première lecture gagner.
  const found = new Map<Id<"users">, Doc<"users">>();
  const byIndex = [raw, ...(lower === raw ? [] : [lower])];
  for (const candidate of byIndex) {
    const rows = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", candidate))
      .take(1);
    if (rows[0]) found.set(rows[0]._id, rows[0]);
  }
  const scanned = await ctx.db.query("users").take(BOOTSTRAP_SCAN_LIMIT);
  for (const row of scanned) {
    if (row.email?.trim().toLowerCase() === lower) found.set(row._id, row);
  }

  if (found.size > 1) {
    throw new Error(
      "Plusieurs comptes portent cet email à la casse près : passe « userId » pour lever l'ambiguïté.",
    );
  }
  return [...found.values()][0] ?? null;
}

/**
 * Amorçage du PREMIER administrateur — fonction INTERNE, donc réservée à
 * l'exploitation (clé admin du déploiement). Voir le commentaire ci-dessus.
 */
export const bootstrapAdmin = internalMutation({
  args: { email: v.optional(v.string()), userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if ((args.email !== undefined) === (args.userId !== undefined)) {
      throw new Error("Indique soit « email », soit « userId » — exactement un des deux.");
    }

    const target = await resolveBootstrapTarget(ctx, args);
    if (!target) {
      throw new Error(
        "Compte introuvable : vérifie l'email, ou passe « userId » (table users).",
      );
    }
    if (target.isAnonymous === true) {
      throw new Error("Un compte anonyme ne peut pas devenir administrateur.");
    }

    if (await anyAdminExists(ctx)) {
      // Rejouer le script pour le MÊME compte reste sans effet, mais un
      // second compte ne peut pas être promu par cette voie.
      if (target.role === ROLES.ADMIN) return { ok: true as const, userId: target._id };
      throw new Error(
        "Un administrateur existe déjà : utilise « setRole » depuis ce compte pour nommer un autre administrateur.",
      );
    }

    await ctx.db.patch(target._id, { role: ROLES.ADMIN });
    return { ok: true as const, userId: target._id };
  },
});

export const setRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("user"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.userId, { role: args.role });
    return { ok: true as const };
  },
});

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [contents, sources, logs, users, transcriptions, favorites, history] = await Promise.all([
      ctx.db.query("ovContents").withIndex("by_seen").order("desc").take(600),
      ctx.db.query("ovSources").take(40),
      ctx.db.query("ovLogs").withIndex("by_created").order("desc").take(60),
      ctx.db.query("users").take(300),
      ctx.db.query("ovTranscriptions").order("desc").take(200),
      ctx.db.query("ovFavorites").order("desc").take(300),
      ctx.db.query("ovHistory").order("desc").take(300),
    ]);

    const byKind: Record<string, number> = {};
    const byRights: Record<string, number> = {};
    for (const c of contents) {
      byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
      byRights[c.rightsStatus] = (byRights[c.rightsStatus] ?? 0) + 1;
    }

    return {
      totals: {
        contents: contents.length,
        playable: contents.filter((c) => c.hostingAllowed || c.fullStreamAllowed).length,
        blocked: contents.filter((c) => c.rightsStatus === "UNKNOWN" || c.rightsStatus === "RESTRICTED").length,
        sources: sources.length,
        activeSources: sources.filter((s) => s.active).length,
        users: users.length,
        transcriptions: transcriptions.length,
        translations: transcriptions.filter((t) => t.status === "done").length,
        favorites: favorites.length,
        historyEntries: history.length,
      },
      byKind,
      byRights,
      sources,
      errors: logs.filter((l) => l.level === "error"),
      alerts: logs.filter((l) => l.level === "warn" && l.scope === "rights"),
      recentLogs: logs,
      blockedContents: contents
        .filter((c) => c.rightsStatus === "UNKNOWN" || c.rightsStatus === "RESTRICTED")
        .slice(0, 30)
        .map((c) => ({
          key: c.key,
          title: c.title,
          source: c.source,
          kind: c.kind,
          rightsStatus: c.rightsStatus,
          reviewed: Boolean(c.rightsReviewedBy),
          reason: c.blockedReason,
        })),
      topContents: contents
        .slice()
        .sort((a, b) => (b.searchCount ?? 0) - (a.searchCount ?? 0))
        .slice(0, 12),
    };
  },
});

export const listContents = query({
  args: {
    rights: v.optional(rightsStatusValidator),
    source: v.optional(v.string()),
    kind: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(args.limit ?? 50, 200);
    if (args.rights) {
      return await ctx.db
        .query("ovContents")
        .withIndex("by_rights", (q) => q.eq("rightsStatus", args.rights!))
        .order("desc")
        .take(limit);
    }
    if (args.source) {
      return await ctx.db
        .query("ovContents")
        .withIndex("by_source", (q) => q.eq("source", args.source!))
        .order("desc")
        .take(limit);
    }
    if (args.kind) {
      return await ctx.db
        .query("ovContents")
        .withIndex("by_kind", (q) => q.eq("kind", args.kind!))
        .order("desc")
        .take(limit);
    }
    return await ctx.db.query("ovContents").withIndex("by_seen").order("desc").take(limit);
  },
});

/**
 * Revue manuelle des droits : un administrateur qui a vérifié une licence
 * peut lever (ou durcir) le statut. La décision est tracée dans le registre
 * et la source n'écrasera plus ce contenu (verrou `rightsReviewedBy`).
 */
export const reviewRights = mutation({
  args: {
    contentKey: v.string(),
    rightsStatus: rightsStatusValidator,
    commercialUseAllowed: v.boolean(),
    fullStreamAllowed: v.boolean(),
    downloadAllowed: v.boolean(),
    hostingAllowed: v.boolean(),
    translationAllowed: v.boolean(),
    derivativeWorkAllowed: v.boolean(),
    /* Champs du modèle de droits demandés par le produit : une revue humaine
       peut préciser le territoire, la date d'expiration des droits et le
       caractère obligatoire de l'attribution. Sans valeur fournie, on ne
       modifie pas l'existant (aucune donnée inventée). */
    territory: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    attributionRequired: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const content = await ctx.db
      .query("ovContents")
      .withIndex("by_key", (q) => q.eq("key", args.contentKey))
      .unique();
    if (!content) throw new Error("Contenu introuvable.");
    const now = Date.now();
    await ctx.db.patch(content._id, {
      rightsStatus: args.rightsStatus,
      commercialUseAllowed: args.commercialUseAllowed,
      fullStreamAllowed: args.fullStreamAllowed,
      downloadAllowed: args.downloadAllowed,
      hostingAllowed: args.hostingAllowed,
      translationAllowed: args.translationAllowed,
      derivativeWorkAllowed: args.derivativeWorkAllowed,
      rightsSource: "admin",
      rightsReviewedBy: adminId,
      rightsReviewedAt: now,
      blockedReason: args.note,
      ...(args.territory !== undefined ? { territory: args.territory } : {}),
      ...(args.expiresAt !== undefined ? { expiresAt: args.expiresAt } : {}),
      ...(args.attributionRequired !== undefined
        ? { attributionRequired: args.attributionRequired }
        : {}),
    });
    await ctx.db.insert("ovRightsLedger", {
      contentKey: args.contentKey,
      source: content.source,
      rightsStatus: args.rightsStatus,
      mode: args.fullStreamAllowed ? "stream" : args.hostingAllowed ? "stream" : "external",
      reasons: [args.note ?? "Revue manuelle de l'administration"],
      actor: adminId,
      createdAt: now,
    });
    return { ok: true as const };
  },
});

/* ═══════════════════════════════════════════════════════════════════
   JOURNAL CLIENT (P0.2 / P0.2.1)

   `logClientEvent` reste PUBLIC et ANONYME À DESSEIN : le produit doit
   pouvoir tracer un refus d'upload ou une erreur de lecteur AVANT que
   l'utilisateur ne soit connecté (et l'écran de connexion lui-même).
   Rendre l'authentification obligatoire supprimerait précisément les
   événements qui expliquent un échec de début de parcours.

   Ce qui est borné :
   • la PORTÉE est un identifiant structuré (`a-z0-9._:-`), pas une chaîne
     libre — impossible d'y déverser un texte arbitraire ou un blob ;
   • tailles REJETÉES (et non silencieusement tronquées) : message ≤ 500,
     meta ≤ 1000. Une troncature cachait l'abus au lieu de le refuser ;
   • le VOLUME repose sur DEUX plafonds indépendants, lus sur des index
     existants (`by_scope`, `by_created`) :
       1. par portée (60/min) — borne le matraquage d'une même portée ;
       2. GLOBAL (300/min) — la portée étant choisie par le client, le
          premier plafond se contournait en inventant une portée neuve à
          chaque appel (« rotation infinie »). Le plafond global ne dépend
          d'AUCUNE valeur fournie par l'appelant ;
   • les JETONS sont masqués avant écriture (JWT et « Bearer … ») : le
     journal ne doit jamais devenir l'endroit où fuite une clé.

   Ce que ce mécanisme NE peut PAS garantir, dit franchement :
   • la DISPONIBILITÉ du journal : un appelant peut saturer la fenêtre
     globale et faire refuser des événements légitimes. Le plafond protège
     le STOCKAGE (croissance bornée), pas l'accès au journal ;
   • l'ATOMICITÉ du plafond : la fenêtre est lue puis écrite sans compteur
     partagé, donc N appels strictement simultanés peuvent dépasser le
     plafond de N au plus. `convex-test` sérialisant les mutations de
     premier niveau, cet effet n'y est pas observable ;
   • une limite PAR IDENTITÉ : `ovLogs` n'a pas d'index par utilisateur, et
     un quota par compte ne protégerait de toute façon pas les appels
     anonymes (qui n'ont pas d'identité à plafonner).
   ═══════════════════════════════════════════════════════════════════ */

/** Portée = identifiant : minuscules/chiffres/`.`/`_`/`:`/`-`, 1 à 40 car. */
const LOG_SCOPE_RE = /^[a-z0-9][a-z0-9._:-]{0,39}$/i;
const LOG_MESSAGE_MAX = 500;
const LOG_META_MAX = 1000;
/** Fenêtre anti-spam : une minute, deux plafonds indépendants. */
const LOG_RATE_WINDOW_MS = 60_000;
/** Plafond par portée — borne le matraquage d'une même portée. */
const LOG_RATE_MAX_PER_SCOPE = 60;
/** Plafond global — ne dépend d'aucune valeur choisie par le client. */
const LOG_RATE_MAX_GLOBAL = 300;
/** JWT (`a.b.c`) et en-têtes « Bearer … » : masqués avant écriture. */
const LOG_SECRET_RE =
  /(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,})|(bearer\s+[A-Za-z0-9._~+/-]{12,}=*)/gi;

/** Remplace tout secret reconnaissable par un marqueur, jamais par du vide. */
function redactSecrets(text: string): string {
  return text.replace(LOG_SECRET_RE, "[secret masqué]");
}

/** Événements de CETTE portée dans la fenêtre courante (lecture bornée). */
async function eventsInWindowForScope(ctx: MutationCtx, scope: string): Promise<number> {
  const recent = await ctx.db
    .query("ovLogs")
    .withIndex("by_scope", (q) => q.eq("scope", scope))
    .order("desc")
    .take(LOG_RATE_MAX_PER_SCOPE + 1);
  const since = Date.now() - LOG_RATE_WINDOW_MS;
  return recent.filter((row) => row.createdAt >= since).length;
}

/** Événements toutes portées confondues dans la fenêtre (lecture bornée). */
async function eventsInWindowGlobal(ctx: MutationCtx): Promise<number> {
  const recent = await ctx.db
    .query("ovLogs")
    .withIndex("by_created")
    .order("desc")
    .take(LOG_RATE_MAX_GLOBAL + 1);
  const since = Date.now() - LOG_RATE_WINDOW_MS;
  return recent.filter((row) => row.createdAt >= since).length;
}

/**
 * Refuse un événement de plus au-delà des plafonds de la fenêtre courante.
 * Les deux plafonds sont vérifiés : une portée neuve ne contourne pas le
 * plafond global (c'est exactement ce que la rotation de portée exploitait).
 */
async function assertLogBudget(ctx: MutationCtx, scope: string): Promise<void> {
  if ((await eventsInWindowForScope(ctx, scope)) >= LOG_RATE_MAX_PER_SCOPE) {
    throw new Error(
      `Trop d'événements journalisés sur « ${scope} » : réessaie dans une minute.`,
    );
  }
  if ((await eventsInWindowGlobal(ctx)) >= LOG_RATE_MAX_GLOBAL) {
    throw new Error(
      "Trop d'événements journalisés (plafond global du journal) : réessaie dans une minute.",
    );
  }
}

/** Journalise un événement côté client (upload refusé, erreur lecteur…). */
export const logClientEvent = mutation({
  args: {
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    scope: v.string(),
    message: v.string(),
    meta: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = args.scope.trim();
    if (!LOG_SCOPE_RE.test(scope)) {
      throw new Error(
        "Portée d'événement invalide : identifiant attendu (lettres, chiffres, . _ : -).",
      );
    }
    const message = redactSecrets(args.message.trim());
    if (message.length === 0) throw new Error("Événement sans message : refusé.");
    if (message.length > LOG_MESSAGE_MAX) {
      throw new Error(`Message d'événement trop long (max ${LOG_MESSAGE_MAX} caractères).`);
    }
    if (args.meta !== undefined && args.meta.length > LOG_META_MAX) {
      throw new Error(`Métadonnées d'événement trop longues (max ${LOG_META_MAX} caractères).`);
    }

    await assertLogBudget(ctx, scope);

    const userId = await getAuthUserId(ctx);
    await ctx.db.insert("ovLogs", {
      level: args.level,
      scope,
      message,
      meta: args.meta !== undefined ? redactSecrets(args.meta) : undefined,
      userId: userId ?? undefined,
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});
