# MOOVY — worker ASR local (faster-whisper natif)

> ## ⚠️ Mode ALTERNATIF — plus le chemin principal
>
> Depuis la refonte « tout hébergé dans le déploiement », Shadow transcrit et
> traduit **dans le déploiement Freebuff lui-même** : Whisper ONNX + OPUS-MT
> exécutés par le navigateur de l'utilisateur (`src/lib/localEngines.ts`),
> transcript poussé par `mediaHub2.ingestLocalTranscript`. Aucun service à
> lancer n'est nécessaire.
>
> Ce worker reste disponible **si tu veux déporter l'ASR sur ta propre
> machine** : renseigne alors `WHISPER_LOCAL_URL` (URL **joignable depuis
> Convex**, pas `localhost`) et le pipeline serveur l'utilisera en repli,
> par exemple pour les fichiers énormes (> 64 Mo) que le moteur navigateur
> refuse. Un `localhost:8000` configuré côté Convex désigne le loopback du
> runtime Convex, pas ta machine.

## Mode Python natif (recommandé ici — pas besoin de Docker)

```bash
cd workers
pip install -r requirements.txt
WHISPER_MODEL=base python3 -m uvicorn whisper_worker:app --host 0.0.0.0 --port 8000
```

- `GET  /health` → `200 {"status":"ok","engine":"faster_whisper_local","model":"...","device":"..."}`
  (le modèle par défaut est chargé au premier health check : 200 prouve un
  worker réellement prêt, pas juste un port ouvert)
- `POST /v1/audio/transcriptions` (multipart, OpenAI-compatible)
  champs : `file`, `model` (facultatif), `language` (facultatif — hint
  `media.language`), `response_format` (`verbose_json`|`json`|`text`),
  `timestamp_granularities[]` (`segment`, `word`)

Avec `timestamp_granularities[]=word`, faster-whisper tourne avec
`word_timestamps=True` et chaque segment porte ses vrais `words[]` :

```json
{
  "text": "Bonjour tout le monde, bienvenue dans MOOVY.",
  "language": "fr",
  "segments": [
    {
      "start": 0.0, "end": 2.5, "text": "Bonjour tout le monde,",
      "words": [ { "word": "Bonjour", "start": 0.0, "end": 0.4, "probability": 0.93 } ]
    }
  ]
}
```

## Mode Docker (optionnel)

```bash
cd workers && docker compose up -d
```

⚠️ Le compose n'est PAS une preuve de runtime. Vérifier ensuite :

```bash
curl -fsS http://localhost:8000/health
curl -fsS -X POST http://localhost:8000/v1/audio/transcriptions \
  -F file=@/tmp/test-fr.wav -F model=base -F language=fr \
  -F response_format=verbose_json \
  -F timestamp_granularities[]=segment -F timestamp_granularities[]=word
```

## Câblage MOOVY

Dans Convex Settings (Keys/API keys) — aucune clé secrète, URL locale :

```
WHISPER_LOCAL_URL  = http://localhost:8000     # contrat conservé
WHISPER_MODEL      = base    # tiny|base|small|medium|large-v3 (défaut code : base)
```

Variables du worker : `WHISPER_MODEL`, `WHISPER_DEVICE` (`auto|cpu|cuda`),
`WHISPER_COMPUTE_TYPE` (`int8` par défaut CPU, `float16` GPU).
`asrEngine.ts` sélectionne ce worker en priorité ; sans `WHISPER_LOCAL_URL`
ni `GROQ_API_KEY` le pipeline répond explicitement `ASR_WORKER_UNAVAILABLE`.
