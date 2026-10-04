# OPENVERSE MEDIA — Architecture

> **Moteur universel de recherche et de consultation de contenus.**
> Pas un système de récupération illégale de catalogues.

---

## 1. Règle absolue : les droits

Aucun contenu n'est **téléchargé, hébergé, redistribué ou streamé** parce qu'une API permet de le trouver.

Chaque contenu traverse le **Rights Engine** (`src/convex/ovRights.ts`) avant d'atteindre l'interface.

| `rights_status`  | Signification                        | Lecture intégrée |
| ---------------- | ------------------------------------ | ---------------- |
| `PUBLIC_DOMAIN`  | Domaine public                       | 🟢 oui           |
| `CC_ALLOWED`     | Creative Commons                     | 🟢 si la licence autorise la redistribution |
| `RIGHTS_GRANTED` | Droits explicitement accordés        | 🟢 oui           |
| `EMBED_ALLOWED`  | Intégration / extrait officiel       | 🟡 lecteur externe |
| `EXTERNAL_ONLY`  | Source officielle uniquement         | 🔵 redirection   |
| `UNKNOWN`        | Aucune information fiable            | 🔴 bloqué        |
| `RESTRICTED`     | Protégé / DRM                        | 🔴 bloqué        |

Six drapeaux stockés par contenu : `commercial_use_allowed`, `full_stream_allowed`,
`download_allowed`, `hosting_allowed`, `translation_allowed`, `derivative_work_allowed`.

**Comportement par défaut :** dans le doute → pas d'hébergement, pas de contournement de DRM, pas de
téléchargement. Uniquement les informations autorisées + un lien vers la source officielle.

> Une licence **non commerciale** est bloquée car la plateforme est exploitée commercialement. Une licence
> `CC-BY-ND` autorise la lecture mais interdit la traduction et toute œuvre dérivée.

### Revue humaine

Si un administrateur vérifie une licence, sa décision **verrouille** le contenu (`rightsReviewedBy`) : les
connecteurs ne l'écrasent plus. Chaque décision est tracée dans `ovRightsLedger`.

---

## 2. Modules

| #  | Module                | Fichiers |
| -- | --------------------- | -------- |
| 1  | Frontend              | `src/components/openverse/*`, `src/pages/Landing.tsx`, `src/pages/Dashboard.tsx` |
| 2  | Backend (actions)     | `src/convex/ovSearch.ts`, `ovStudio.ts`, `ovStudioEngine.ts` |
| 3  | Database              | `src/convex/schema.ts` (tables `ov*`) |
| 4  | Search Engine         | `src/convex/ovSearch.ts` (`searchUniversal`, `suggest`, `trending`) |
| 5  | Source Connectors     | `src/convex/ovSources.ts` + connecteurs dans `ovSearch.ts` |
| 6  | Rights Engine         | `src/convex/ovRights.ts` |
| 7  | Video Player          | `src/components/openverse/Players.tsx` → `VideoPlayer` |
| 8  | Audio Player          | `Players.tsx` → `AudioPlayer` |
| 9  | Book Reader           | `Players.tsx` → `BookReader` |
| 10 | Transcription Engine  | `ovStudio.ts` + `ovStudioEngine.ts` |
| 11 | Translation Engine    | `ovStudioEngine.ts` (`translateRemote`) |
| 12 | Subtitle Engine       | `ovStudio.ts` (`saveSubtitle`), génération `.srt`/`.vtt` dans `src/openverse/model.ts` |
| 13 | Recommendation Engine | `ovLibrary.ts` → `recommendations` |
| 14 | User System           | Convex Auth + `ovLibrary.ts` + `ovPreferences` |
| 15 | Admin Dashboard       | `ovAdmin.ts` + `src/components/openverse/AdminView.tsx` |

Chaque module est remplaçable indépendamment.

---

## 3. Connecteurs

**Contenus exploitables (aucune clé requise) :** Internet Archive, Prelinger Archives, LibriVox
(hébergé par Internet Archive), Wikimedia Commons.

**Métadonnées — information seulement :** Open Library, MusicBrainz, Wikipédia/Wikidata.
⚠️ Une source de métadonnées n'est **jamais** une source de streaming.

**Désactivés :** Gutendex (l'API répond par une redirection 301 qui expire systématiquement — passer
`searchEnabled: true` dans `ovSources.ts` suffit à la réactiver), JustWatch (endpoint non public),
IMDb datasets (import local massif).

### Qui déclare le domaine public ?

La licence d'un item prime toujours. À défaut, **seules** les collections dont le contrat de licence est
public (Prelinger, LibriVox) peuvent déclarer `PUBLIC_DOMAIN` au niveau du connecteur. Les téléversements
anonymes d'Internet Archive restent `UNKNOWN` — donc bloqués. C'est ce qui permet d'avoir à la fois des
audiobooks LibriVox lisibles immédiatement et un refus net sur tout ce qui est douteux.

**Prêts, en attente de clé :** TMDB, OMDb, Watchmode, Trakt, Europeana, Openverse.
**Désactivés volontairement :** JustWatch (endpoint non public), IMDb datasets (import local massif).

L'état de chaque connecteur est visible dans **Paramètres → Connecteurs** et dans le dashboard admin.

---

## 4. Proxy média

`src/convex/ovProxy.ts` expose `GET /ov/proxy?url=…` :

- liste blanche d'hôtes (protection SSRF) ;
- HTTPS obligatoire ;
- relais de l'en-tête `Range` (lecture et seek) ;
- en-têtes CORS + cache.

Les lecteurs ne parlent jamais directement aux sources. Aucune clé ne transite par ce endpoint.

---

## 5. Variables d'environnement (côté serveur uniquement)

À renseigner dans l'onglet **Keys / API keys** — jamais dans le frontend.

```ini
# ── Priorité 1 : moteurs locaux, gratuits ────────────────────────────
WHISPER_LOCAL_URL=http://whisper:9000          # whisper.cpp / faster-whisper (API compatible OpenAI)
WHISPER_MODEL=whisper-large-v3-turbo
TRANSLATE_LOCAL_URL=http://libretranslate:5000 # LibreTranslate auto-hébergé

# ── Priorité 2 : API gratuites (fallback, facultatif) ───────────────
GROQ_API_KEY=                                  # transcription audio hébergée
# MyMemory (traduction de secours) : aucune clé

# ── Connecteurs facultatifs ─────────────────────────────────────────
TMDB_API_KEY=
OMDB_API_KEY=
WATCHMODE_API_KEY=
TRAKT_CLIENT_ID=
EUROPEANA_API_KEY=
OPENVERSE_CLIENT_ID=
OPENVERSE_CLIENT_SECRET=

# ── Divers ──────────────────────────────────────────────────────────
OPENVERSE_CONTACT=contact@exemple.org          # User-Agent exigé par Wikimedia et MusicBrainz
```

Sans aucune clé, l'application reste **entièrement fonctionnelle** pour : la recherche universelle, la
lecture des contenus du domaine public et CC, la lecture des textes Gutenberg, les sous-titres `.srt`/`.vtt`
issus d'un texte source, et la traduction via MyMemory.

---

## 6. Déploiement local (compatible Docker / PostgreSQL / Qdrant / Ollama / FFmpeg)

Le socle applicatif tourne sur Vite + React + Convex. Les briques lourdes sont externalisées derrière des
URL configurables, ce qui permet un déploiement 100 % auto-hébergé :

```yaml
# docker-compose.yml (extrait indicatif)
services:
  whisper:
    image: onerahmet/openai-whisper-asr-webservice:latest
    environment:
      - ASR_MODEL=large-v3
    ports: ["9000:9000"]
  libretranslate:
    image: libretranslate/libretranslate:latest
    ports: ["5000:5000"]
  qdrant:
    image: qdrant/qdrant:latest
    ports: ["6333:6333"]
  ollama:
    image: ollama/ollama:latest
    ports: ["11434:11434"]
  postgres:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD=change-me
    ports: ["5432:5432"]
```

- `WHISPER_LOCAL_URL` pointe vers `whisper`, `TRANSLATE_LOCAL_URL` vers `libretranslate`.
- **Qdrant** : à brancher dans un module de recherche sémantique (embeddings locaux via Ollama).
- **PostgreSQL** : utilisé si l'on remplace le stockage Convex par un backend SQL auto-hébergé.
- **FFmpeg** : extraction audio et génération des pistes avant transcription.

---

## 7. Défense en profondeur

- **Authentification** : Convex Auth (OTP e-mail + invité) ; routes protégées par `<RequireAuth>` avec
  `returnTo`, donc aucune perte de contexte.
- **Rôles** : `admin` / `user` / `member`. L'administration est réservée ; le premier compte peut revendiquer
  le rôle (amorçage), ensuite la porte se ferme.
- **Rate limiting** : 30 recherches par minute et par compte (au-delà, message explicite).
- **Validation** : tous les arguments de fonction sont validés par Convex ; les sous-titres et passages à
  traduire sont bornés en taille.
- **Clés** : exclusivement lues via `process.env` dans les actions serveur.
- **Proxy** : liste blanche d'hôtes, HTTPS requis.
- **Journalisation** : `ovLogs` (erreurs connecteurs, alertes droits, refus du studio) consultable dans le
  dashboard admin.

---

## 8. Vérifications

```bash
bunx convex dev --once && bun tsc -b --noEmit
```

## 9. Moteurs locaux du déploiement (ASR + traduction) — architecture par défaut

Shadow n'a **aucun service à lancer** : la transcription et la traduction sont
hébergées dans le déploiement, exécutées par `src/lib/localEngines.ts`.

```
fichier uploadé
  ↓ decodeToPcm16k             (WebAudio — l'audio ne quitte pas l'appareil)
Float32Array 16 kHz
  ↓ transcribeLocal            (Whisper ONNX, onnx-community/whisper-base_timestamped)
segments + WORD TIMESTAMPS réels du moteur
  ↓ translateLocal             (OPUS-MT ONNX, Helsinki-NLP)
textes traduits (start/end inchangés)
  ↓ ingestLocalTranscript      (action Convex, propriété du média vérifiée)
runSharedPipeline → sous-titres → Shadow (karaoké mot par mot) → Memory
```

**Pourquoi dans le navigateur et pas dans une fonction Convex ?** Le runtime
Convex exécute les fonctions avec 512 Mio de RAM, sans binaire natif, sans
processus long, et la taille de code du déploiement est plafonnée à 32 Mio :
un moteur Whisper ne peut y être hébergé. L'appel de l'onglet est donc le seul
emplacement réellement hébergé par Freebuff qui puisse faire tourner le
moteur — les poids sont des fichiers statiques libres, mis en cache par le
navigateur (aucune clé, aucune API payante).

- Moteur principal : `browser_whisper_local` (badge UI « transcription Whisper
  locale (dans ton navigateur) ») — **jamais Groq sur ce chemin**.
- Traduction : `browser_opus_mt_local`, paire directe ou pivot par l'anglais.
  Sans route connue pour la paire, le serveur reprend la main
  (LibreTranslate/Argos local puis cascade gratuite) — jamais une traduction
  vide présentée comme réussie.
- Repli serveur explicite : fichier > 64 Mo, audio > 20 min, décodage
  impossible ou moteur indisponible → `kickPipeline` (worker auto-hébergé
  `WHISPER_LOCAL_URL` puis Groq), avec le badge correspondant.
- Bornes appliquées : type MIME, taille (64 Mo / 20 min), 5 000 segments,
  400 000 caractères, inférence sérialisée, modèle chargé une seule fois.

Test manuel conseillé :

1. Rechercher « sherlock holmes » → résultats Gutenberg (🟢), Open Library (🔵), Internet Archive.
2. Ouvrir un livre Gutenberg → lecteur texte, pagination, recherche interne, traduction d'un passage.
3. Ouvrir un film Internet Archive sans licence → statut 🔴 et explication, aucun lecteur.
4. Ouvrir un contenu CC → transcription (texte source), export `.srt` / `.vtt`, traduction vers l'anglais.
