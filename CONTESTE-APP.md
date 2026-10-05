# LINGUA NOIR — CONtexte de reprise (source de vérité)

> **Ce fichier est le plus important du projet.** Il contient l'intégralité de l'état de
> l'application : ce qui existe, ce qui manque, où sont les données, comment tout démarre.
> Si un jour l'application ou les conversations sont perdues, **ce fichier suffit à tout
> reconstruire**. Ne le supprime jamais. Mets-le à jour après chaque session de travail.

Dernière mise à jour : **5 octobre 2026**

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

### ✅ État actuel : backend local Convex, opérationnel

Le backend tourne **en local dans Docker** — aucun compte Convex Cloud nécessaire.

```bash
# 1. Backend Convex (Docker Desktop doit être lancé)
cd C:\Users\leanc\Downloads\convex-local
docker compose up -d
docker compose exec backend ./generate_admin_key.sh   # → clé admin

# 2. Brancher le projet
cd C:\Users\leanc\Downloads\lingua-noir
# (clé admin dans .env.local : CONVEX_SELF_HOSTED_ADMIN_KEY)
npx convex dev --once          # pousse le schéma + génère _generated
npx convex run slang:seed      # 2 417 expressions (idempotent)
npx convex run crossSeed:seedCrossConcepts

# 3. L'app
npm run dev                    # http://localhost:5173
```

| Service | URL |
|---|---|
| Backend Convex | `http://127.0.0.1:33210` |
| Site proxy / auth (OIDC + JWKS) | `http://host.docker.internal:33211` |
| Application | `http://localhost:5173` |

### Variables d'environnement

`.env.local` (gitignoré) :

```
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:33210
CONVEX_SELF_HOSTED_ADMIN_KEY=lingua-noir-local|<clé>
VITE_CONVEX_URL=http://127.0.0.1:33210
VITE_CONVEX_SITE_URL=http://host.docker.internal:33211
CONVEX_SITE_URL=http://localhost:5173
```

Variables côté **serveur Convex** (`npx convex env set`) :

| Variable | Valeur | Pourquoi |
|---|---|---|
| `VLY_CONVEX_AUTH_ISSUER` | `https://freebuff.com` | providers d'auth federated |
| `JWKS` | `convex-local/jwks.json` | signature des JWT |
| `JWT_PRIVATE_KEY` | `convex-local/jwt_private.pem` | idem (côté serveur) |
| `SITE_URL` | `http://host.docker.internal:33211` | issuer OIDC |

### ⚠️ Pièges du self-hosted (coûteux à retrouver)

- `npx convex dev --local` **échoue sur Windows** : `Failed to generate admin key: spawn UNKNOWN`.
- L'image Docker est sur **`ghcr.io`**, plus sur Docker Hub ni quay.io.
- `CONVEX_SITE_URL` est une variable **built-in** : elle suit `CONVEX_SITE_ORIGIN` du
  conteneur et ne peut pas être définie par `convex env set`.
- `CONVEX_SITE_ORIGIN` doit être joignable **depuis le conteneur ET depuis le
  navigateur** → `host.docker.internal`, pas `127.0.0.1` (inaccessible de l'intérieur).
- `CONVEX_SITE_ORIGIN` sans `INSTANCE_NAME`/`INSTANCE_SECRET` ⇒ pas de routage HTTP ⇒
  `/.well-known/openid-configuration` non résolu.
- La clé admin générée porte le préfixe `lingua-noir-local|` dès qu'`INSTANCE_NAME`
  est défini (et non `convex-self-hosted|`). Elle change à chaque recréation du conteneur.
- Convex Auth n'est **pas** supporté par le CLI en self-hosted : il faut pousser
  `JWKS` / `JWT_PRIVATE_KEY` / `SITE_URL` à la main.

### Option Convex Cloud (si tu veux retrouver l'app d'origine)

```bash
npx convex login
npx convex dev --once --configure new --project lingua-noir --dev-deployment cloud
```

Une **clé d'intégration VLY** (`sk_*`) est requise pour l'IA, l'email et les paiements.

### Remise en route de la base de données
Les tables se créent au démarrage du backend Convex d'après `schema.ts`. Les données
d'argot se rejouent avec `slang:seed` et `crossSeed:seedCrossConcepts` (voir section 4).

**Le plus simple : double-clique sur `RESTAURER.cmd`** — il enchaîne dépendances,
connexion Convex, création du déploiement, seeds et lancement de l'app.

> ⚠️ `npx convex dev --local` (backend hors-ligne) **échoue sur cette machine Windows** :
> `Failed to generate admin key: spawn UNKNOWN`. Il faut Convex Cloud.

---

## 8. Bugs connus

### ✅ CORRIGÉ le 4 octobre 2026 — un calque décoratif avalait TOUS les clics

**Cause racine mesurée** : `NetworkBackdrop` / `NoirAmbience` posent
`pointer-events: none` sur leur div racine, mais ce n'est **pas hérité** quand un enfant
(le `<canvas>` react-three-fiber et ses div internes) force `pointer-events: auto`.
Résultat : une toile 3D plein écran, censée être purement décorative, interceptait
tous les clics de l'application — d'où les « boutons qui ne font rien ».

Preuve (mesurée dans Chromium, pas supposée) :

```
elementFromPoint(366, 347)
  AVANT -> CANVAS / pointer-events: auto        ← la toile décorative
  APRÈS -> P / pointer-events: auto             ← le vrai contenu cliquable
```

**Correctif** : classe `.ln-ambient` sur les calques d'ambiance (`src/index.css`) avec
`.ln-ambient, .ln-ambient * { pointer-events: none !important; }`, plus
`pointer-events-none` sur le `<ParticleNetwork>`.

Effet mesuré : la sélection de langue dans l'onboarding fonctionne (carte passe en
`border-gold/50`) et le bouton « Continuer » passe de `disabled: true` à
`disabled: false`. Toute la famille de bugs « boutons bloqués » vient probablement de là.

### ✅ CORRIGÉ le 5 octobre 2026 — quatre bugs d'interface

**1. La porte d'onboarding rendait l'app entière inatteignable.**
`AppShell` remplaçait la totalité du shell par `<Onboarding />` dès qu'aucune langue
de focus n'était choisie : aucune URL, pas même `/app/conversation`, n'atteignait son
écran. Le bouton « Explorer d'abord, choisir plus tard » est ajouté sous l'assistant, et
le choix est mémorisé en `sessionStorage` (`ln.onboarding.skipped`) — sans quoi un simple
F5 rejouait l'écran. Un bandeau non bloquant rappelle l'étape tant que la liste est vide.
*Vérifié : depuis un compte invité vierge, `/app/conversation` rend bien l'écran (nav
présente), la bannière s'affiche, et le bandeau survit au rechargement.*

**2. Le bouton « Commencer la conversation » était muet.**
`disabled` avec la raison uniquement dans `title` — donc invisible au doigt, au mobile et
au lecteur d'écran. La checklist est désormais visible juste au-dessus :
`✗ PERSONNAGE | ✗ SCÉNARIO`, chaque étape passant en or quand elle est choisie, et le
bouton la décrit via `aria-describedby`.
*Règle permanente : jamais de bouton désactivé sans raison lisible sans survol.*
*Vérifié : `✗ ✗ / disabled:true` → `✓ ✓ / disabled:false` après sélection.*

**3. La boutique annonçait « il te manque 500 gems » pendant le chargement.**
`stats?.gems ?? 0` faisait passer un solde inconnu pour un solde nul. Tant que
`getUserStats` est en vol : skeleton doré pour le solde, libellé « Chargement… », et
aucun tooltip « il te manque ».
*Vérifié à l'écran (capture) en forçant l'état `stats === undefined`.*

**4. `MediaCard` n'était ni tactile ni clavier.**
`<article onClick>` sans `tabIndex` ni `role`, et le halo de lecture n'apparaissait qu'au
survol (`group-hover:opacity-100`) : sur mobile la carte semblait morte. La carte est
maintenant focusable et activable au clavier (Entrée / Espace), et le halo s'affiche
quand l'appareil n'a pas de survol (`[@media(hover:none)]`) ou après un tap.
*Vérifié sur le catalogue réel : 48 cartes, toutes `role="button"` + `tabindex="0"` +
`aria-label` ; `Entrée` sur une carte ouvre bien `/app/content/<clé>` ; halo à `opacity: 0`
sur un poste à survol, et la règle `@media (hover: none) { opacity: 1 }` est bien générée
par Tailwind.*

### ✅ CORRIGÉ le 5 octobre 2026 — la landing sous-annonçait 54 expressions

`landingStats.getLandingNumbers` renvoyait la **constante** `expressions: 2363`, alors que
le seed `SLANG_SEED_2025` (55 entrées, cf. §4) porte le catalogue à **2 417** — et que la
constante ne se recalculait jamais. Le nombre est désormais une **mesure** : la mutation
`slang:recomputeAggregates` dénormalise le total du catalogue dans `slangAggregates` sous
la clé `total:catalog`, et la landing lit cette ligne (une seule lecture d'index, pas de
scan par visiteur). Le compteur de la landing est formaté dans la locale de l'interface.
*Vérifié : `landingStats:getLandingNumbers` → `{"expressions": 2417}` ; la carte affiche
« 2 417 » en français.*

> Après toute modification du seed, relancer `npx convex run slang:seed '{}'` : c'est lui
> qui appelle `recomputeAggregates` et remet le compteur d'aplomb.

### ⏳ À corriger ensuite

1. **Quota YouTube** — les sous-titres YouTube échouent parfois. Porte de secours déjà
   en place : import SRT/VTT universel (`src/lib/subtitleParse.ts`).
2. **Clé d'intégration VLY `sk_*`** — Conversation IA, traduction Whisper et
   retranscription restent inactives tant qu'elle n'est pas fournie.

### 🔎 Où se trouve le moteur de recherche média (piège de nommage)

Dans `/app/screen`, `/app/music`, `/app/books`, `/app/talk`, le sélecteur à deux boutons
ne veut **pas** dire ce qu'il annonce :

| Bouton | `tools` | Ce qui s'affiche |
|---|---|---|
| **Catalogue réel** | `false` | `MediaHubScreen` / `MusicTab` — les connecteurs historiques (Deezer, YouTube, TMDB…). **C'est le mode par défaut.** |
| **Studio IA** | `true` | `Rayon` → `ovSearch.browseLive` / `searchUniversal` → **les `MediaCard`** |

Donc les cartes cliquables du moteur OpenVerse sont derrière « **Studio IA** ». `Rayon`
interroge les connecteurs au premier montage et **ingère le résultat dans `ovContents`** :
la table n'est pas vide à l'installation, elle se remplit à la première visite. Le
conteneur Docker a bien Internet (Openverse répond depuis l'intérieur).

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