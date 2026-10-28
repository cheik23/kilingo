"""Tests unitaires du worker : contrat HTTP, bornes et erreurs explicites.

Aucun modèle n'est téléchargé : `FakeEngine` reproduit le contrat de
`WhisperEngine` et permet de tester le service seul (validation, formats,
tailles, codes HTTP).
"""

from __future__ import annotations

import io
import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import (  # noqa: E402
    AudioTooLong,
    InvalidAudio,
    Segment,
    Transcription,
    create_app,
)

WAV = b"RIFF$\x00\x00\x00WAVEfmt " + b"\x00" * 40


class FakeEngine:
    model_name = "base"
    device = "cpu"
    compute_type = "int8"
    load_seconds = 0.01

    def __init__(self, ready: bool = True, error: str | None = None):
        self.ready = ready
        self.error = error
        self.last_language = "__unset__"
        self.last_words = None

    def transcribe(self, audio, *, language, want_words, max_seconds):
        self.last_language = language
        self.last_words = want_words
        if not audio:
            raise InvalidAudio("Fichier audio vide.")
        words = (
            [{"word": "Hello", "start": 0.0, "end": 0.5, "probability": 0.9}]
            if want_words
            else None
        )
        return Transcription(
            text="Hello world. This is a test.",
            language=language or "en",
            duration=2.5,
            segments=[
                Segment(id=0, start=0.0, end=1.2, text="Hello world.", words=words),
                Segment(id=1, start=1.2, end=2.5, text="This is a test."),
            ],
        )


def client(engine=None, **env):
    for key, value in env.items():
        os.environ[key] = str(value)
    app = create_app(engine or FakeEngine(), load_model=False)
    return TestClient(app)


@pytest.fixture(autouse=True)
def clean_env():
    keys = ["ASR_MAX_UPLOAD_BYTES", "ASR_MAX_AUDIO_SECONDS"]
    before = {k: os.environ.get(k) for k in keys}
    yield
    for key, value in before.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value


def post(
    client_,
    *,
    audio=WAV,
    model="base",
    response_format="verbose_json",
    language=None,
    granularities=("segment",),
):
    data = {
        "model": model,
        "response_format": response_format,
        "timestamp_granularities[]": list(granularities),
    }
    if language:
        data["language"] = language
    files = {"file": ("sample.wav", io.BytesIO(audio), "audio/wav")}
    return client_.post("/v1/audio/transcriptions", data=data, files=files)


def test_health_ready():
    r = client().get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True
    assert body["engine"] == "faster-whisper"
    assert body["model"] == "base"


def test_health_model_unavailable():
    r = client(FakeEngine(ready=False, error="ModelUnavailable: no weights")).get("/health")
    assert r.status_code == 503
    body = r.json()
    assert body["status"] == "error"
    assert body["model_loaded"] is False
    assert "no weights" in body["error"]


def test_verbose_json_contract():
    r = post(client())
    assert r.status_code == 200
    body = r.json()
    assert body["text"].startswith("Hello world")
    assert body["language"] == "en"
    assert body["duration"] == 2.5
    seg = body["segments"][0]
    for key in ("id", "start", "end", "text"):
        assert key in seg
    assert seg["end"] >= seg["start"]


def test_language_hint_is_forwarded():
    engine = FakeEngine()
    r = post(client(engine), language="fr-FR")
    assert r.status_code == 200
    assert engine.last_language == "fr"
    assert r.json()["language"] == "fr"


def test_word_granularity():
    engine = FakeEngine()
    r = post(client(engine), granularities=("segment", "word"))
    assert r.status_code == 200
    assert engine.last_words is True
    assert r.json()["segments"][0]["words"][0]["word"] == "Hello"
    assert r.json()["words"]


def test_audio_too_long_is_explicit():
    class Long(FakeEngine):
        def transcribe(self, *a, **k):
            raise AudioTooLong("Audio trop long (4000 s > 1800 s).")

    r = post(client(Long()))
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "audio_too_long"


def test_json_format_has_no_segments():
    r = post(client(), response_format="json")
    assert r.status_code == 200
    assert "segments" not in r.json()


def test_text_format():
    r = post(client(), response_format="text")
    assert r.status_code == 200
    assert r.text.strip().startswith("Hello world")


def test_unsupported_response_format():
    r = post(client(), response_format="srt")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "unsupported_response_format"


def test_model_mismatch_is_explicit():
    r = post(client(), model="large-v3")
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "model_unavailable"
    assert "large-v3" in r.json()["error"]["message"]


def test_upload_too_large():
    c = client(ASR_MAX_UPLOAD_BYTES=1024)
    r = post(c, audio=b"\x00" * 4096)
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "audio_too_large"


def test_empty_file_rejected():
    r = post(client(), audio=b"")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "empty_audio"


def test_empty_transcript_is_valid():
    """Silence décodé = 200 avec texte vide, pas une erreur (diagnostic)."""

    class Silent(FakeEngine):
        def transcribe(self, *a, **k):
            return Transcription(text="", language="en", duration=1.0, segments=[])

    r = post(client(Silent()))
    assert r.status_code == 200
    assert r.json()["text"] == ""
    assert r.json()["segments"] == []


def test_engine_failure_is_not_reported_as_bad_file():
    """CUDA/cuBLAS absent = 503 moteur, jamais 422 « fichier corrompu »."""

    class NoCublas(FakeEngine):
        def transcribe(self, *a, **k):
            raise RuntimeError(
                "Library libcublas.so.12 is not found or cannot be loaded"
            )

    r = post(client(NoCublas()))
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "engine_error"
    assert "libcublas" in r.json()["error"]["message"]


def test_invalid_audio_is_explicit():
    class Broken(FakeEngine):
        def transcribe(self, *a, **k):
            raise InvalidAudio("Fichier audio illisible ou corrompu (InvalidDataError).")

    r = post(client(Broken()))
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_audio"
    assert "illisible" in r.json()["error"]["message"]
