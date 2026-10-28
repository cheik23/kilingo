# Worker ASR local — faster-whisper

Service d'inférence **auto-hébergé**, compatible avec l'API OpenAI
`/v1/audio/transcriptions`, qui remplace l'absence de moteur quand Kɪ́LINGO
tourne sans `GROQ_API_KEY`.

Il expose exactement le contrat attendu par le backend Convex :
`selectAsrEndpoint()` (`src/convex/asrEngine.ts`), `postWhisper()`
(`src/convex/connectors/groqWhisper.ts`) et `transcribeAudio()`
(`src/convex/youtubePipeline.ts`) appellent tous
`{WHISPER_LOCAL_URL}/v1/audio/transcriptions` en multipart, avec
`response_format=verbose_json` et `timestamp_granularities[]=segment|word`.

## Démarrage

```bash
docker build -t kilingo-asr-worker ./asr-worker
docker run --rm -p 127.0.0.1:8000:8000 \
  -e ASR_MODEL=base -e ASR_DEVICE=cpu -e ASR_COMPUTE_TYPE=int8 \
  -v kilingo-asr-models:/models \
  kilingo-asr-worker
```

Puis, côté Convex :

```bash
npx convex env set WHISPER_LOCAL_URL http://<service>:8000
npx convex env set WHISPER_MODEL base   # doit correspondre à ASR_MODEL
```

`WHISPER_LOCAL_URL` peut déjà contenir `/v1/audio/transcriptions` : le
backend tolère les deux formes.

## Variables

| Variable | Défaut | Rôle |
|---|---|---|
| `ASR_MODEL` | `base` | Modèle faster-whisper (`tiny`, `base`, `small`, `medium`, `large-v3`…) |
| `ASR_DEVICE` | `cpu` | `cpu` ou `cuda` |
| `ASR_COMPUTE_TYPE` | `int8` | `int8` (CPU), `float16` (GPU), `int8_float16` |
| `ASR_CPU_THREADS` | `0` | Threads CPU (0 = décision de CTranslate2) |
| `ASR_BEAM_SIZE` | `1` | Rapidité vs qualité |
| `ASR_MAX_UPLOAD_BYTES` | `31457280` (30 Mo) | Refus 413 au-delà |
| `ASR_MAX_AUDIO_SECONDS` | `1800` | Refus 422 au-delà |

Les poids sont téléchargés au premier démarrage depuis Hugging Face puis
conservés dans `HF_HOME=/models` (volume). Aucune clé, aucune API payante.

## Endpoints

- `GET /health` — `200` si le modèle est chargé, `503` sinon. Le corps
  distingue service vivant (`status`), modèle (`model_loaded`, `model`),
  matériel (`device`, `compute_type`) et erreur de chargement (`error`).
- `POST /v1/audio/transcriptions` — `file` obligatoire, `model`,
  `response_format` (`json` \| `verbose_json` \| `text`), `language`,
  `timestamp_granularities[]`. Réponse `verbose_json` :
  `{task, language, duration, text, segments[{id,start,end,text,words?}]}`.

Erreurs JSON stables : `audio_too_large` (413), `empty_audio` (422),
`invalid_audio` (422), `audio_too_long` (422),
`unsupported_response_format` (400), `model_unavailable` (503).

## Modèle demandé ≠ modèle chargé

Le worker **refuse** (503 `model_unavailable`) un `model` différent de
`ASR_MODEL` : sans cela, un `WHISPER_MODEL=large-v3` resté par défaut
donnerait l'illusion d'un grand modèle alors que le service en sert un
petit. `whisper-1` est accepté comme alias générique.

## GPU

`ASR_DEVICE=cuda` exige `--gpus all` **et** les bibliothèques CUDA à
l'exécution. `nvidia-smi` ne suffit pas : sans cuBLAS, le modèle se charge
puis la première inférence échoue (`libcublas.so.12 is not found`).

```bash
docker build --build-arg ASR_CUDA=1 -t kilingo-asr-worker:gpu ./asr-worker
docker run --rm --gpus all -p 127.0.0.1:8000:8000 \
  -e ASR_MODEL=base -e ASR_DEVICE=cuda -e ASR_COMPUTE_TYPE=float16 \
  -v kilingo-asr-models:/models kilingo-asr-worker:gpu
```

Mesuré sur RTX 5060 Laptop (8 Go, driver 610.74) avec `base` :

| Mesure | CPU `int8` | GPU `float16` |
|---|---|---|
| 11 s d'audio, après chauffe | 0,50–0,59 s | 0,26–0,40 s |
| 726 s d'audio | 105–106 s | 58,1 s |
| première inférence (init JIT/cuBLAS) | — | 11,4 s |
| mémoire du conteneur | 384 Mo au repos, pic 515 Mo (chunk 20 Mo) | VRAM 348 Mo au repos, pic 499 Mo |

Le chargement du modèle prend ~1 s dans les deux cas (poids déjà en
cache). Le CPU reste le défaut (aucune dépendance CUDA) ; le GPU divise
par ~1,8 le temps des longs fichiers. Un upload unique de 29 Mo (sans
découpage) a monté le pic mémoire CPU à ~1,19 Go : c'est pourquoi le
pipeline Convex découpe avant l'envoi.

Une panne moteur (CUDA/cuBLAS/OOM) renvoie **503 `engine_error`**, jamais
un 422 « fichier corrompu » : un fichier valide ne doit pas être accusé
à la place de l'infrastructure.

## Journalisation

Une ligne par requête : identifiant, taille, langue, durée, nombre de
segments, temps de traitement. **Jamais** l'audio, ni le texte transcrit.

## Réseau

Le service n'a pas d'authentification : il doit rester sur un réseau privé
(compose/WSL), **sans port publié sur Internet**. Pour un hébergement,
placer un reverse-proxy authentifié devant.
