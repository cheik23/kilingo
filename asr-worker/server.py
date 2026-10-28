"""Kɪ́LINGO — worker ASR local, compatible OpenAI (`/v1/audio/transcriptions`).

Cet endpoint est celui que le backend Convex appelle via `WHISPER_LOCAL_URL`
(`selectAsrEndpoint`, `connectors/groqWhisper.postWhisper`, `transcribeAudio`).
Il doit donc accepter exactement le contrat déjà utilisé par le projet :

    POST /v1/audio/transcriptions   (multipart/form-data)
      file                       = fichier audio (wav/mp3/m4a/webm/ogg…)
      model                      = nom du modèle demandé
      response_format            = "json" | "verbose_json" | "text"
      timestamp_granularities[]  = "segment" (et "word" quand demandé)
      language                   = code ISO-639-1 optionnel

Réponse `verbose_json` : {task, language, duration, text, segments:[…], words?}
avec des timestamps RÉELS du moteur — jamais inventés.

Sécurité / exploitation :
  • aucune transcription ni aucun octet audio n'est journalisé ;
  • taille et durée plafonnées (variables d'environnement) ;
  • erreurs explicites (413/415/422/400/503) au lieu de fuites de trace ;
  • /health distingue service vivant, modèle chargé et moteur en erreur.
"""

from __future__ import annotations

import io
import logging
import os
import re
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any, Iterable, Optional

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, PlainTextResponse

LOG = logging.getLogger("kilingo.asr")
logging.basicConfig(
    level=os.getenv("ASR_LOG_LEVEL", "info").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

ENGINE_NAME = "faster-whisper"
DEFAULT_MAX_UPLOAD_BYTES = 30 * 1024 * 1024
DEFAULT_MAX_AUDIO_SECONDS = 30 * 60
LOADED_AT = time.time()


# ─── Erreurs métier ──────────────────────────────────────────────────────


class WorkerError(Exception):
    """Erreur exposée au client avec un statut HTTP et un code stable."""

    status_code = 500
    code = "worker_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class AudioTooLarge(WorkerError):
    status_code = 413
    code = "audio_too_large"


class EmptyAudio(WorkerError):
    status_code = 422
    code = "empty_audio"


class InvalidAudio(WorkerError):
    status_code = 422
    code = "invalid_audio"


class UnsupportedFormat(WorkerError):
    status_code = 400
    code = "unsupported_response_format"


class ModelUnavailable(WorkerError):
    status_code = 503
    code = "model_unavailable"


class AudioTooLong(WorkerError):
    status_code = 422
    code = "audio_too_long"


class EngineError(WorkerError):
    """Panne du moteur (CUDA/cuBLAS/cuDNN, mémoire, périphérique).

    Distincte de `invalid_audio` : un fichier valide sur un moteur cassé ne
    doit pas être présenté comme un fichier corrompu.
    """

    status_code = 503
    code = "engine_error"


# Bibliothèques/périphériques : panne d'infrastructure, jamais un fichier
# invalide. Motifs observés en pratique : libcublas/cudnn absents, no kernel
# image pour l'architecture GPU, OOM.
_ENGINE_FAILURE_RE = re.compile(
    r"cublas|cudnn|cuda|kernel image|out of memory|device-side|no kernel|library .*not found",
    re.IGNORECASE,
)


def classify_engine_error(exc: Exception) -> WorkerError:
    """Traduit une exception moteur en erreur HTTP juste (503 ou 422)."""
    detail = str(exc).replace("\n", " ")[:160]
    if _ENGINE_FAILURE_RE.search(detail):
        return EngineError(f"Moteur ASR en échec ({type(exc).__name__}) : {detail}")
    return InvalidAudio(f"Fichier audio illisible ou corrompu ({type(exc).__name__}).")


# ─── Moteur ──────────────────────────────────────────────────────────────


@dataclass
class Segment:
    id: int
    start: float
    end: float
    text: str
    words: Optional[list[dict[str, Any]]] = None


@dataclass
class Transcription:
    text: str
    language: str
    duration: float
    segments: list[Segment]


class WhisperEngine:
    """Enveloppe fine autour de faster-whisper (CTranslate2)."""

    def __init__(
        self,
        model_name: str,
        device: str = "cpu",
        compute_type: str = "int8",
        cpu_threads: int = 0,
    ) -> None:
        self.model_name = model_name
        self.device = device
        self.compute_type = compute_type
        self.cpu_threads = cpu_threads
        self._model = None
        self.error: Optional[str] = None
        self.load_seconds: Optional[float] = None

    @property
    def ready(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        started = time.time()
        try:
            from faster_whisper import WhisperModel  # import tardif : tests unitaires

            kwargs: dict[str, Any] = {
                "device": self.device,
                "compute_type": self.compute_type,
            }
            if self.cpu_threads > 0:
                kwargs["cpu_threads"] = self.cpu_threads
            self._model = WhisperModel(self.model_name, **kwargs)
            self.error = None
        except Exception as exc:  # noqa: BLE001 — l'état d'échec doit être exposé
            self._model = None
            self.error = f"{type(exc).__name__}: {exc}"
            LOG.error("chargement du modèle impossible (%s)", type(exc).__name__)
        finally:
            self.load_seconds = round(time.time() - started, 3)

    def transcribe(
        self,
        audio: bytes,
        *,
        language: Optional[str],
        want_words: bool,
        max_seconds: int,
    ) -> Transcription:
        if self._model is None:
            raise ModelUnavailable(
                "Modèle ASR non chargé : vérifie /health et les journaux du worker."
            )
        # faster-whisper accepte un fichier ou un flux ; io.BytesIO évite
        # d'écrire l'audio sur disque (aucune trace persistée).
        stream = io.BytesIO(audio)
        try:
            segments_iter, info = self._model.transcribe(
                stream,
                language=language,
                task="transcribe",
                beam_size=int(os.getenv("ASR_BEAM_SIZE", "1")),
                vad_filter=True,
                word_timestamps=want_words,
                condition_on_previous_text=False,
            )
            duration = float(getattr(info, "duration", 0.0) or 0.0)
            if duration and duration > max_seconds:
                raise AudioTooLong(
                    f"Audio trop long ({int(duration)} s > {max_seconds} s) : découpe-le avant l'envoi."
                )
            out: list[Segment] = []
            for index, seg in enumerate(segments_iter):
                text = (seg.text or "").strip()
                words = None
                if want_words:
                    words = [
                        {
                            "word": w.word,
                            "start": float(w.start),
                            "end": float(w.end),
                            "probability": float(getattr(w, "probability", 0.0) or 0.0),
                        }
                        for w in (getattr(seg, "words", None) or [])
                    ]
                out.append(
                    Segment(
                        id=index,
                        start=float(seg.start),
                        end=float(seg.end),
                        text=text,
                        words=words,
                    )
                )
            text_all = " ".join(s.text for s in out if s.text).strip()
            # Aucun segment n'est PAS une erreur : un silence (ou un extrait
            # sans parole) est un fichier valide dont la transcription est
            # vide. Le diagnostic `testAsrEngine` envoie justement 1 s de
            # silence et attend un 200 : un 422 ferait passer un worker sain
            # pour une panne. Un fichier réellement illisible lève avant.
            return Transcription(
                text=text_all,
                language=str(getattr(info, "language", language or "") or ""),
                duration=duration,
                segments=out,
            )
        except WorkerError:
            raise
        except Exception as exc:  # noqa: BLE001 — erreur explicite, jamais une fuite
            if _ENGINE_FAILURE_RE.search(str(exc)):
                LOG.error("échec moteur (%s)", type(exc).__name__)
            raise classify_engine_error(exc) from exc


def build_engine_from_env() -> WhisperEngine:
    return WhisperEngine(
        model_name=os.getenv("ASR_MODEL", "base").strip() or "base",
        device=os.getenv("ASR_DEVICE", "cpu").strip() or "cpu",
        compute_type=os.getenv("ASR_COMPUTE_TYPE", "int8").strip() or "int8",
        cpu_threads=int(os.getenv("ASR_CPU_THREADS", "0") or 0),
    )


# ─── Application ─────────────────────────────────────────────────────────


def max_upload_bytes() -> int:
    return int(os.getenv("ASR_MAX_UPLOAD_BYTES", str(DEFAULT_MAX_UPLOAD_BYTES)))


def max_audio_seconds() -> int:
    return int(os.getenv("ASR_MAX_AUDIO_SECONDS", str(DEFAULT_MAX_AUDIO_SECONDS)))


def _error_response(exc: WorkerError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.message, "type": exc.code, "code": exc.code}},
    )


def _word_granularity(values: Iterable[str]) -> bool:
    return any(v.strip().lower() == "word" for v in values)


def create_app(engine: Optional[Any] = None, *, load_model: bool = True) -> FastAPI:
    """Fabrique l'app ; `engine` injectable pour les tests unitaires."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if engine is not None:
            app.state.engine = engine
        else:
            app.state.engine = build_engine_from_env()
            if load_model:
                app.state.engine.load()
        started = time.time()
        LOG.info(
            "worker prêt — modèle=%s device=%s compute=%s chargé=%s (%.1f s)",
            getattr(app.state.engine, "model_name", "?"),
            getattr(app.state.engine, "device", "?"),
            getattr(app.state.engine, "compute_type", "?"),
            bool(getattr(app.state.engine, "ready", False)),
            started - LOADED_AT,
        )
        yield

    app = FastAPI(title="KILINGO ASR worker", version="1.0.0", lifespan=lifespan)
    # Un seul exemplaire du modèle en mémoire : les requêtes sont sérialisées
    # par le moteur CTranslate2 lui-même ; pas de pool (RAM/VRAM bornée).
    app.state.started_at = LOADED_AT
    # Moteur injecté : disponible même sans exécution du lifespan (tests).
    if engine is not None:
        app.state.engine = engine

    @app.get("/health")
    async def health(request: Request):
        eng = request.app.state.engine
        ready = bool(getattr(eng, "ready", False))
        body = {
            "status": "ok" if ready else "error",
            "service": "kilingo-asr-worker",
            "engine": ENGINE_NAME,
            "model": getattr(eng, "model_name", None),
            "device": getattr(eng, "device", None),
            "compute_type": getattr(eng, "compute_type", None),
            "model_loaded": ready,
            "load_seconds": getattr(eng, "load_seconds", None),
            "error": getattr(eng, "error", None) if not ready else None,
            "max_upload_bytes": max_upload_bytes(),
            "max_audio_seconds": max_audio_seconds(),
            "uptime_s": round(time.time() - request.app.state.started_at, 1),
        }
        return JSONResponse(status_code=200 if ready else 503, content=body)

    @app.post("/v1/audio/transcriptions")
    async def transcriptions(
        request: Request,
        file: UploadFile = File(...),
        model: str = Form(""),
        response_format: str = Form("json"),
        language: Optional[str] = Form(None),
        prompt: Optional[str] = Form(None),  # accepté puis ignoré (compat)
    ):
        request_id = uuid.uuid4().hex[:12]
        fmt = (response_format or "json").strip().lower()
        if fmt not in {"json", "verbose_json", "text"}:
            return _error_response(UnsupportedFormat(f"response_format « {fmt} » non pris en charge."))

        eng = request.app.state.engine
        if not getattr(eng, "ready", False):
            return _error_response(ModelUnavailable("Modèle ASR non chargé."))

        requested = (model or "").strip()
        loaded = str(getattr(eng, "model_name", "") or "")
        if requested and requested not in {loaded, "whisper-1"}:
            return _error_response(
                ModelUnavailable(
                    f"Modèle « {requested} » non chargé : ce worker sert « {loaded} » (WHISPER_MODEL)."
                )
            )

        limit = max_upload_bytes()
        declared = request.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > limit + 64 * 1024:
            return _error_response(
                AudioTooLarge(f"Requête trop volumineuse (max {limit // (1024 * 1024)} Mo).")
            )

        chunks: list[bytes] = []
        total = 0
        while True:
            part = await file.read(1024 * 1024)
            if not part:
                break
            total += len(part)
            if total > limit:
                return _error_response(
                    AudioTooLarge(f"Fichier audio trop volumineux (max {limit // (1024 * 1024)} Mo).")
                )
            chunks.append(part)
        audio = b"".join(chunks)
        if not audio:
            return _error_response(EmptyAudio("Fichier audio vide."))

        granularities = []
        try:
            granularities = request.query_params.getlist("timestamp_granularities[]")
        except Exception:  # pragma: no cover — Starlette expose getlist sans échec
            granularities = []
        # FastAPI n'expose pas les champs répétés du multipart via la signature :
        # on les relit depuis le formulaire brut.
        try:
            form = await request.form()
            granularities += [str(v) for v in form.getlist("timestamp_granularities[]")]
        except Exception:  # pragma: no cover — formulaire déjà consommé
            pass
        want_words = _word_granularity(granularities)

        lang = (language or "").strip().lower().split("-")[0] or None
        if lang and not (len(lang) == 2 and lang.isalpha()):
            lang = None

        started = time.time()
        try:
            result = eng.transcribe(
                audio,
                language=lang,
                want_words=want_words,
                max_seconds=max_audio_seconds(),
            )
        except WorkerError as exc:
            LOG.info(
                "requête %s refusée — %s (%d octets)",
                request_id,
                exc.code,
                len(audio),
            )
            return _error_response(exc)
        except Exception as exc:  # noqa: BLE001 — moteur injecté/tests
            classified = classify_engine_error(exc)
            LOG.info(
                "requête %s échouée — %s (%d octets)",
                request_id,
                classified.code,
                len(audio),
            )
            return _error_response(classified)
        elapsed = round(time.time() - started, 2)
        # Journal minimal : aucune parole, aucun octet, aucune transcription.
        LOG.info(
            "requête %s — %d octets, langue=%s, durée=%.1f s, %d segments, %.2f s",
            request_id,
            len(audio),
            result.language or "auto",
            result.duration,
            len(result.segments),
            elapsed,
        )

        if fmt == "text":
            return PlainTextResponse(result.text)

        if fmt == "json":
            return JSONResponse(
                {
                    "text": result.text,
                    "language": result.language,
                    "duration": result.duration,
                }
            )

        payload: dict[str, Any] = {
            "task": "transcribe",
            "language": result.language,
            "duration": result.duration,
            "text": result.text,
            "model": loaded,
            "segments": [
                {
                    "id": s.id,
                    "seek": 0,
                    "start": s.start,
                    "end": s.end,
                    "text": f" {s.text}",
                    "tokens": [],
                    "temperature": 0.0,
                    "avg_logprob": 0.0,
                    "compression_ratio": 1.0,
                    "no_speech_prob": 0.0,
                    **({"words": s.words} if s.words is not None else {}),
                }
                for s in result.segments
            ],
        }
        if want_words:
            payload["words"] = [w for s in result.segments for w in (s.words or [])]
        return JSONResponse(payload)

    return app


app = create_app()
