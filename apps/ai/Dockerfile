FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY apps/ai/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Bake the local embedding model into the image so containers never download it at runtime.
ARG EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
ENV EMBEDDING_PROVIDER=local \
    EMBEDDING_MODEL=${EMBEDDING_MODEL} \
    EMBEDDING_CACHE_DIR=/opt/fastembed
RUN python -c "import os; from fastembed import TextEmbedding; TextEmbedding(os.environ['EMBEDDING_MODEL'], cache_dir=os.environ['EMBEDDING_CACHE_DIR'])"

COPY apps/ai/src/ ./src/

ENV PYTHONPATH=/app/src

EXPOSE 8000
CMD ["uvicorn", "tenderpulse_ai.main:app", "--host", "0.0.0.0", "--port", "8000"]
