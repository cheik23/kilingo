# KILINGO — Workers open source (ASR + Traduction)

Ce dossier contient le déploiement de production des deux workers consommés par
le pipeline Shadow via `WHISPER_LOCAL_URL` et `TRANSLATE_LOCAL_URL`.

## Services

| Service | Image | Endpoint consommé | Env KILINGO |
|---|---|---|---|
| ASR (faster-whisper) | `fedirz/faster-whisper-server:latest-cpu` (ou `latest-cuda`) | `POST /v1/audio/transcriptions` (OpenAI-compatible) | `WHISPER_LOCAL_URL=http://asr:8000` |
| Traduction (LibreTranslate/Argos) | `libretranslate/libretranslate:latest` | `POST /translate`, `GET /languages` | `TRANSLATE_LOCAL_URL=http://translate:5000` |

## Lancer

```bash
cd workers
docker compose up -d
# health checks
curl http://localhost:8000/health          # ASR → {"status":"ok"}
curl http://localhost:5000/languages       # → [{code, name}, ...]
```

Puis dans Convex Settings (bouton Keys/API keys) :

```
WHISPER_LOCAL_URL   = http://asr:8000        # ou http://host.docker.internal:8000
TRANSLATE_LOCAL_URL = http://translate:5000  # ou http://host.docker.internal:5000
```

Aucune clé, aucun service propriétaire : sans ces deux variables le pipeline
retombe sur Groq (repli), et sans Groq il répond `ASR_WORKER_UNAVAILABLE` —
jamais de faux succès.

## Modèle ASR et qualité

- `SZ_MODEL` contrôle le modèle faster-whisper chargé (`tiny`, `base`,
  `small`, `medium`, `large-v3`). `base` convient pour tester ; `small` ou
  `medium` sont recommandés en production CPU (compromis précision/latence).
- Le hint de langue est envoyé par le pipeline quand la langue du média est
  connue (correction d'auto-détection prouvée en runtime).

## Timestamps de mots (karaoké fin)

La build PyPI `faster-whisper-server==0.0.2` n'expose pas les word timestamps
(elle ignore `timestamp_granularities[]="word"`). Le pipeline les demande et
les consomme dès qu'un serveur les fournit (l'image Docker récente de
faster-whisper-server et Speaches les exposent) — aucune modification Shadow
nécessaire : le contrat `WhisperSegment.words` est déjà en place.

## Paires de traduction (Argos)

L'image LibreTranslate télécharge les packs Argos à la première traduction
(languid-mode par défaut). Paires directes du cœur : `en↔fr`, `en↔es`,
`es↔pt` ; toute autre paire (ex. `es→fr`) passe par le **pivot Argos**
(es→en→fr) — prouvé en runtime : HTTP 200 avec texte réel.
Pour forcer l'installation complète de packs au démarrage, monter
`LT_UPDATE_MODELS=true` (premier boot plus long).

## Vérifier de bout en bout

```bash
# transcription réelle
curl -s -X POST http://localhost:8000/v1/audio/transcriptions \
  -F file=@/tmp/test-fr.wav -F model=small -F language=fr \
  -F response_format=verbose_json | head -c 400

# traduction réelle
curl -s -X POST http://localhost:5000/translate \
  -H 'Content-Type: application/json' \
  -d '{"q":"Bonjour tout le monde","source":"fr","target":"en","format":"text"}'
```
