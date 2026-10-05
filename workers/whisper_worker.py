#!/usr/bin/env python3
"""KILINGO — worker ASR local (faster-whisper, sans Docker).

Contrat OpenAI-compatible consommé par `asrEngine.ts` via WHISPER_LOCAL_URL :

  GET  /health                    → {"status": "ok", "model": "...", "device": "..."}
  POST /v1/audio/transcriptions   → verbose_json (segments + words)

Le worker appelle directement `faster_whisper.WhisperModel.transcribe(...)`
avec `word_timestamps=True` quand la granularité `word` est demandée — les
timestamps de mots sont RÉELS (issus de faster-whisper), jamais fabriqués côté
frontend ou Convex.

Lancement :
    cd workers
    pip install -r requirements.txt
    WHISPER_MODEL=small uvicorn whisper_worker:app --host 0.0.0.0 --port 8000

Puis dans KILINGO (Convex Settings / Keys) :
    WHISPER_LOCAL_URL = http://localhost:8000
"""
from __future__ import annotations

import io
import os
import time
from typing import Any, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 Mo — garde-fou, pas de limite API cloud
AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".oga", ".opus", ".flac", ".webm", ".mp4", ".mpeg", ".mpga", ".aac", ".wma"}

app = FastAPI(title="KILINGO — faster-whisper worker", version="1.0.0")

_model = None
_model_name: Optional[str] = None
_device: Optional[str] = None


def _requested_model(model_field: Optional[str]) -> str:
    """Modèle utilisé : champ de requête > env WHISPER_MODEL > défaut raisonnable.

    `tiny`/`base` pour les tests rapides ; `small`/`medium` recommandés en
    production CPU. `large-v3` n'est PAS forcé — dépend de la machine.
    """
    if model_field and model_field.strip():
        return model_field.strip()
    env_model = (os.getenv("WHISPER_MODEL") or "").strip()
    return env_model or "base"


def _load_model(name: str):
    """Charge (et met en cache) le modèle faster-whisper demandé."""
    global _model, _model_name, _device
    if _model is not None and _model_name == name:
        return _model
    from faster_whisper import WhisperModel  # import tardif : /health répond sans modèle

    requested_device = (os.getenv("WHISPER_DEVICE") or "").strip() or None
    compute = (os.getenv("WHISPER_COMPUTE_TYPE") or "").strip() or None
    started = time.time()
    model = WhisperModel(
        name,
        device=requested_device or "auto",
        compute_type=compute or "int8",
    )
    _model = model
    _model_name = name
    try:
        _device = str(model.model.instance_config.get("device", "unknown"))  # type: ignore[attr-defined]
    except Exception:  # pragma: no cover - détail cosmétique
        _device = requested_device or "auto"
    print(f"[whisper_worker] modèle « {name} » chargé en {time.time() - started:.1f}s", flush=True)
    return model


@app.get("/health")
def health(model: Optional[str] = None) -> dict[str, Any]:
    """Health check : HTTP 200 + JSON dès que le process est prêt à servir.

    Charge le modèle demandé (`?model=small`) ou le modèle par défaut au
    premier appel pour prouver que le worker est réellement fonctionnel
    (pas juste « le port est ouvert »).
    """
    model_name = _requested_model(model)
    try:
        _load_model(model_name)
    except Exception as err:  # le port répond mais le moteur est cassé → 503
        raise HTTPException(status_code=503, detail=f"model unavailable: {err}") from err
    return {
        "status": "ok",
        "engine": "faster_whisper_local",
        "model": _model_name or model_name,
        "device": _device or "unknown",
    }


def _wants_words(granularities: list[str]) -> bool:
    return "word" in granularities


def _parse_granularities(
    granularities: list[str],
    granularities_bracket: list[str],
    response_format: str,
) -> list[str]:
    """Granularités demandées (`timestamp_granularities[]` ou `timestamp_granularities`).

    verbose_json ⇒ segments toujours produits ; `word` ajoute les timestamps
    de mots réels. (OpenAI exige `segment`+`word` ensemble ; on reste souple.)
    """
    requested = [g.strip().lower() for g in (*granularities, *granularities_bracket) if g.strip()]
    if not requested:
        return ["segment"]
    return requested


def _segments_to_verbose_json(
    segments: list[Any],
    info: Any,
    include_words: bool,
) -> dict[str, Any]:
    """Conversion vers le format verbose_json + `words[]` réels par segment."""
    out_segments: list[dict[str, Any]] = []
    full_text_parts: list[str] = []
    for seg in segments:
        entry: dict[str, Any] = {
            "id": int(seg.id),
            "start": float(seg.start),
            "end": float(seg.end),
            "text": seg.text.strip(),
            "avg_logprob": float(seg.avg_logprob),
            "no_speech_prob": float(seg.no_speech_prob),
        }
        if include_words:
            entry["words"] = [
                {
                    "word": w.word.strip(),
                    "start": float(w.start),
                    "end": float(w.end),
                    "probability": float(w.probability),
                }
                for w in (seg.words or [])
                if w.start is not None and w.end is not None
            ]
        out_segments.append(entry)
        full_text_parts.append(seg.text.strip())
    return {
        "text": " ".join(p for p in full_text_parts if p).strip(),
        "language": info.language,
        "language_probability": float(info.language_probability),
        "duration": float(info.duration),
        "segments": out_segments,
    }


@app.post("/v1/audio/transcriptions")
async def transcriptions(
    file: UploadFile = File(...),
    model: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    response_format: str = Form("json"),
    prompt: Optional[str] = Form(None),
    timestamp_granularities: list[str] = Form([]),
    timestamp_granularities_bracket: list[str] = Form([], alias="timestamp_granularities[]"),
) -> JSONResponse:
    """Transcription réelle via faster-whisper (`word_timestamps=True` si demandé)."""
    filename = file.filename or "audio.wav"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in AUDIO_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"INVALID_AUDIO — extension non audio : « {ext} »")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="INVALID_AUDIO — fichier vide")
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="INVALID_AUDIO — fichier trop volumineux (100 Mo max)")

    granularities = _parse_granularities(timestamp_granularities, timestamp_granularities_bracket, response_format)
    include_words = _wants_words(granularities)
    model_name = _requested_model(model)

    lang = (language or "").strip()
    if lang and len(lang.split("-")[0]) != 2:
        raise HTTPException(status_code=400, detail=f"INVALID_AUDIO — code langue invalide : « {lang} »")

    print(
        f"[whisper_worker] REQUEST file={filename} bytes={len(payload)} model={model_name} "
        f"language={lang or 'auto'} words={include_words}",
        flush=True,
    )
    try:
        fw_model = _load_model(model_name)
        segments, info = fw_model.transcribe(
            io.BytesIO(payload),
            language=(lang.split("-")[0] if lang else None),  # None ⇒ auto-détection
            word_timestamps=include_words,
            vad_filter=False,
            condition_on_previous_text=True,
            initial_prompt=prompt or None,  # faster-whisper : `initial_prompt`, pas `prompt`
        )
        result = _segments_to_verbose_json(list(segments), info, include_words)
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=422, detail=f"ASR_FAILED — {type(err).__name__}: {err}") from err

    print(
        f"[whisper_worker] RESPONSE model={model_name} segments={len(result['segments'])} "
        f"words={sum(len(s.get('words') or []) for s in result['segments'])} language={result['language']}",
        flush=True,
    )
    if response_format == "text":
        return JSONResponse(result["text"])
    if response_format not in ("json", "verbose_json"):
        raise HTTPException(status_code=400, detail=f"response_format non supporté : « {response_format} » (utiliser json|verbose_json|text)")
    return JSONResponse(result)
