# Kɪ́LINGO — worker ASR local (faster-whisper, compatible OpenAI)
# CPU int8 par défaut : aucune dépendance CUDA/cuDNN requise.
# GPU : voir README (ASR_DEVICE=cuda + image CUDA + --gpus all).
FROM python:3.11-slim

# ffmpeg : décodage des conteneurs que PyAV ne couvre pas toujours
# (m4a/webm) et outil de préparation des fixtures de test.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Variante GPU optionnelle : CTranslate2 charge les noyaux CUDA mais a besoin
# de cuBLAS/cuDNN à l'EXÉCUTION. `nvidia-smi` seul ne prouve rien (observé :
# modèle chargé sur GPU puis échec « libcublas.so.12 is not found »).
ARG ASR_CUDA=0
RUN if [ "$ASR_CUDA" = "1" ]; then \
      pip install --no-cache-dir nvidia-cublas-cu12 nvidia-cudnn-cu12; \
    fi
ENV LD_LIBRARY_PATH=/usr/local/lib/python3.11/site-packages/nvidia/cublas/lib:/usr/local/lib/python3.11/site-packages/nvidia/cudnn/lib

COPY server.py ./
COPY tests ./tests

ENV ASR_MODEL=base \
    ASR_DEVICE=cpu \
    ASR_COMPUTE_TYPE=int8 \
    ASR_MAX_UPLOAD_BYTES=31457280 \
    ASR_MAX_AUDIO_SECONDS=1800 \
    HF_HOME=/models \
    PYTHONUNBUFFERED=1

# Poids téléchargés au premier démarrage puis conservés dans /models
# (volume dédié en test). Aucune API d'inférence, aucun compte.
VOLUME ["/models"]
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=180s --retries=6 \
    CMD curl -fsS http://127.0.0.1:8000/health > /dev/null || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
