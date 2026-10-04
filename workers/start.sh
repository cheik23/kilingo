#!/usr/bin/env bash
# MOOVY — démarrage worker ASR natif (sans Docker)
# Usage : WHISPER_MODEL=small ./workers/start.sh [port]
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-${WHISPER_PORT:-8000}}"
python3 -m pip install --quiet -r requirements.txt
echo "[start.sh] worker ASR sur http://0.0.0.0:${PORT} — modèle: ${WHISPER_MODEL:-base}"
exec python3 -m uvicorn whisper_worker:app --host 0.0.0.0 --port "${PORT}"
