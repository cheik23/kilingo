# LINGUA NOIR — CONtexte de reprise (source de vérité)

> **Ce fichier est le plus important du projet.** Il contient l'intégralité de l'état de
> l'application : ce qui existe, ce qui manque, où sont les données, comment tout démarre.
> Si un jour l'application ou les conversations sont perdues, **ce fichier suffit à tout
> reconstruire**. Ne le supprime jamais. Mets-le à jour après chaque session de travail.

Dernière mise à jour : **4 octobre 2026**

---

## 1. Qu'est-ce que l'application ?

**Lingua Noir** — plateforme d'apprentissage des langues et de l'argot (africain et
international) **à travers les médias** : musique, films/séries, livres, podcasts, radio.

Règle d'or du produit : **tout se fait dans l'application** — transcription, traduction,
lecture, SRS, dictionnaire — sans être renvoyé vers Spotify / Netflix / YouTube, tout en
respectant les droits de diffusion (Openverse Rights Engine).

Cible : apprenants diaspora / étrangers qui veulent comprendre et se faire comprendre
(haoussa, yoruba, zoulou, wolof, swahili, lingala, …) en apprenant **par l'écoute réelle**,
pas par des manuels.

---

## 2. ⭐ Où est le code ? (la bonne nouvelle)

Le code **n'est pas perdu**. Il est intégralement récupéré ici :

```
C:\Users\leanc\Downloads\lingua-noir\          ← projet restauré (281 fichiers src)
C:\Users\leanc\Downloads\lingua-noir-main.zip  ← archive d'origine (389 fichiers)
```

| Élément | État |
|---|---|
| Frontend (`src/`) — 281 fichiers | ✅ Intact |
| Backend Convex (`src/convex/`) — 94 fichiers | ✅ Intact |
| Schéma base de données (`schema.ts`) | ✅ Intact |
| Données d'argot (2 419 expressions) | ✅ Intact dans les fichiers seed |
| Déploiement Convex (la base **en ligne**) | ❌ Perdu — données d'utilisateurs incluses |
| Preview Freebuff `shy-geckos-help.freebuff.dev` | ❌ Perdu |

**Ce qui manque vraiment n'est que la base de données Convex hébergée** (comptes,
progression, historique des apprenants). Le code et le jeu de données de départ sont là.

---

## 3. Stack technique

| Couche | Technologie |
|---|---|
| Build | Vite 7 |
| UI | React 19, TypeScript 5.9, Tailwind CSS v4, shadcn/ui (Radix), lucide-react |
| Routing | react-router v7 (imports depuis `react-router`, **jamais** `react-router-dom`) |
| Backend | **Convex** (base, auth, actions serveur) + Convex Auth (email OTP + invité) |
| IA | `@vly-ai/integrations` (passerelle Freebuff) — conversation, traduction |
| 3D | three.js + @react-three/fiber (mas mascot, cofres, level-up) |
| Animation | framer-motion, lenis (scroll fluide) |
| Reconnaissance vocale | Whisper (`@huggingface/transformers` 3.5.1, WASM in-browser) |
| Paie / IA / email | intégrations VLY (voir `integrations.md`) |

**Gestionnaire de paquets : `bun`** (`bun.lock` est présent). npm fonctionne aussi.

---

## 4. Les 2 419 expressions d'argot

Elles sont **dans le code**, pas seulement en base :

| Fichier | Entrées | Contenu |
|---|---|---|
| `src/convex/slangSeed.ts` | 974 | base principale (`SLANG_SEED_EXTRA`) |
| `src/convex/slangSeedAfrica.ts` | 1 390 | langues africaines (argot, expressions) |
| `src/convex/slangSeed2025.ts` | 55 | mots récents / argot 2025 |
| `src/convex/crossSeed.ts` | — | concepts transversaux (ponts entre langues) |

→ **12 langues** couvertes.

### ⚠️ Bug de seed détecté le 4 octobre 2026

`slang:seed` (dans `slang.ts`) n'importe que `SLANG_SEED` — lequel n'agrège que
`SLANG_SEED_EXTRA` + `SLANG_SEED_AFRICA`. **`SLANG_SEED_2025` (55 entrées de
`slangSeed2025.ts`) n'est importé nulle part dans le code** : ces 55 mots d'argot 2025
ne sont donc jamais écrits en base, ni avant la perte, ni aujourd'hui.

Pour les inclure, ajouter dans `slangSeed.ts` :

```ts
import { SLANG_SEED_2025 } from "./slangSeed2025";
// puis, dans SLANG_SEED :
  ...SLANG_SEED_2025,
```

### Remise en route de la base

```bash
npx convex run slang:seed                     # ~2 364 entrées, idempotent
npx convex run crossSeed:seedCrossConcepts    # ponts entre langues
```

`slang:seed` déduplique par slug, rafraîchit les copies existantes seulement si elles
ont dérivé, et relance `slang:recomputeAggregates` dans la même transaction. Il peut
donc être relancé à tout moment sans risque.

---

## 5. Les 24 routes de l'application

| Route | Écran |
|---|---|
| `/` | Landing |
| `/invite` | Entrée par invitation |
| `/auth` | Connexion / OTP e-mail |
| `/app` | **Aujourd'hui** — mission du jour, daily drop, raccourcis |
| `/app/space` | **Mon espace** — profil, langues, niveau, stats, vocabulaire, objectifs |
| `/app/analytics` | Tableau de statistiques |
| `/app/quiz` | Quiz contextuels générés depuis le contenu consommé |
| `/app/atlas` | **Atlas** — dictionnaire d'argot (fusionne l'ancien Recherche + Ponts) |
| `/app/conversation` | **Conversation IA** — personnages, scénarios, correction temps réel |
| `/app/store` | Boutique (gems, verrous Premium) |
| `/app/leaderboard` | Classement |
| `/app/achievements` | Badges |
| `/app/invite` | Parrainage / invitations |
| `/app/discover` | Découvrir |
| `/app/memory` | **Mémoire** — répétition espacée (SM-2) |
| `/app/shadow` | **Shadow** — transcription + traduction à droite de la vidéo, karaoké |
| `/app/sleep` | Mode sommeil |
| `/app/screen` | Media Hub — films & séries |
| `/app/music` | Media Hub — musique |
| `/app/books` | Media Hub — livres |
| `/app/talk` | Media Hub — podcasts |
| `/app/hub` | Raccourci Media Hub |
| `/app/content/:key` | Fiche contenu (route profonde partageable) |
| `/app/explore` | Moteur de contenus OpenVerse |
| `/app/library` · `/history` · `/favorites` | Bibliothèque / historique / favoris |
| `/app/settings` | Paramètres, connecteurs, état des moteurs |
| `/app/admin` | Administration (rôle vérifié **côté serveur** via `ovAdmin.amIAdmin`) |
| `/dashboard` | Tableau de bord |
| `*` | 404 |

Routes historiques redirigées : `performance` et `profile` → `/app/space`,
`search` et `bridges` → `/app/atlas`.

---

## 6. Les grands modules

**Apprentissage** — `learning.ts` (cartes SRS `srsCards`, sessions `learningSessions`),
`quizEngine.ts` (quiz multi-format générés depuis le contenu consommé),
`achievements*.ts` + `gamification.ts` (XP, séries, niveaux, badges, `weeklyXp`,
`userLootBoxes`, `userFreezes`), `leaderboard.ts`, `referrals.ts`, `dailyChallenge.ts`,
`dynamicMemory.ts` / `dynamicDict.ts` (dictionnaire dynamique).

**Conversation IA** — `aiCharacters.ts` (personnages), `aiScenarios.ts` (scénarios),
`aiConversation.ts` + `aiConversationStore.ts` (chat, correction temps réel, taux
d'échec au redémarrage déjà corrigé), `asrEngine.ts` (Whisper).

**Médias** — `media.ts`, `mediaHub.ts`…`mediaHub4.ts`, `mediaResolver.ts`,
`mediaJobs*.ts` (pipeline YouTube, sous-titres), `lyricsCache.ts`, `lyricsTranslate.ts`.
~30 connecteurs : podcasts (RSS, TVmaze), musique (Jamendo, Deezer, iTunes,
MusicBrainz), paroles (Genius **avec repli LRCLIB**), films (TMDB), livres
(Google Books, Internet Archive), radio, Wikimedia, Dailymotion.

**OpenVerse** — 22 tables `ov*` : recherche, Rights Engine, sources, studio de création,
admin, lecteur intégré, proxy.

**i18n** — `src/lib/i18n.tsx` + 7 overlays (`i18n.african`, `i18n.avatar`, `i18n.landing`,
`i18n.mascot`, `i18n.mod6`, `i18n.places`, `i18n.pwa`, `i18n.tier3`, `i18n.export`).
Textes présents dans **12 langues**, ajoutés via `applyDictionaryOverlays`.

---

## 7. Démarrage

```bash
cd C:\Users\leanc\Downloads\lingua-noir
npm install                 # ou: bun install

# Le backend Convex : soit le cloud (compte + variables),
# soit en local (Docker est installé sur cette machine).
npx convex dev

# Puis l'app (port 5173)
npm run dev
```

Variables d'environnement (`.env.example`) :

```
VITE_CONVEX_URL=      # rempli par `npx convex dev`
CONVEX_SITE_URL=http://localhost:5173
CONVEX_DEPLOYMENT=    # rempli par `npx convex dev`
```

Côté serveur Convex, l'auth a besoin de `JWKS`, `JWT_PRIVATE_KEY`, `SITE_URL`.
Une **clé d'intégration VLY** (`sk_*`) est requise pour l'IA, l'email et les paiements.

### Remise en route de la base de données
Les tables se créent au démarrage du backend Convex d'après `schema.ts`. Les données
d'argot se rejouent avec `slang:seed` et `crossSeed:seedCrossConcepts` (voir section 4).

**Le plus simple : double-clique sur `RESTAURER.cmd`** — il enchaîne dépendances,
connexion Convex, création du déploiement, seeds et lancement de l'app.

> ⚠️ `npx convex dev --local` (backend hors-ligne) **échoue sur cette machine Windows** :
> `Failed to generate admin key: spawn UNKNOWN`. Il faut Convex Cloud.

---

## 8. Bugs connus à l'arrêt de la dernière session

À corriger en priorité — ils étaient **prouvés par diagnostic**, pas supposés :

1. **Porte d'onboarding bloquante** — un compte sans langue de focus se voit remplacer
   toute l'application par l'assistant (`AppShell.tsx` ~l.362/375). `/app/signs` et
   `/app/conversation` doivent rester atteignables par URL. Correctif prévu : bouton
   « Explorer d'abord ».
2. **Bouton « Commencer » mort** (conversation) — `disabled` avec l'explication
   uniquement en `title`, donc invisible au doigt. Correctif : étapes visibles
   « 1. Personnage ✓/✗ · 2. Scénario ✓/✗ ».
   **Règle permanente : jamais de bouton désactivé sans raison lisible sans survol.**
3. **LSF non tactile** — `SignLanguageView` charge ses vidéos au `mouseenter` seulement,
   donc rien ne se passe au tap. Correctif : la carte entière est un `<button>`,
   `onPointerDown` + `onFocus` ouvrent la fiche et lancent la vidéo.
4. **Boutique** — `StoreView.tsx` ~l.41 affiche « solde insuffisant » pendant que
   `getUserStats` est encore en vol. Correctif : skeleton neutre pendant le chargement.
5. **Quota YouTube** — les sous-titres YouTube échouent parfois. Porte de secours déjà
   en place : import SRT/VTT universel (`src/lib/subtitleParse.ts`).

## 9. Règles du projet (ne pas les casser)

- **Droits** : l'import LSF (Langue des signes) doit rester légal et attribué.
- **Verrous Premium** : 2 personnages gratuits en conversation, rien de plus.
- **Zéro dark pattern** : aucun bouton mort, aucune explication en `title` seul.
- **Ne pas modifier** `src/convex/auth/emailOtp.ts`, `src/convex/auth.config.ts`,
  `src/convex/auth.ts` (auth Convex Auth déjà configurée).
- Sur le front, toujours `useAuth()` de `@/hooks/use-auth` pour l'utilisateur courant.
- `react-resizable-panels` : en React 19, toujours passer un `id` unique à `PanelGroup`.
- Ne **jamais** supprimer une fonctionnalité existante pour « simplifier ».

---

## 10. Le mot de la fin — pourquoi la session a été perdue

Les prompts de ce projet vivaient dans des conversations d'agents éphémères et un
aperçu Freebuff qui a expiré. **La règle pour la suite :**

1. Ce fichier `CONTESTE-APP.md` vit **dans le dépôt**, jamais dans une conversation.
2. Chaque session se termine par : mise à jour de ce fichier + `git commit`.
3. Le projet doit être **versionné dans Git** (il ne l'est pas encore — `git init` fait).
4. Les données d'argot vivent **dans le code** (seeds), pas seulement dans le cloud.
5. Sauvegarde : `lingua-noir-main.zip` dans Downloads **et** une copie hors du disque
   de travail (cloud / clé USB).