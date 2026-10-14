FROM python:3.12-slim-trixie
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg nodejs ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY services/music-import/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY mp3dl-main/mp3dl-main/mp3dl.py mp3dl-main/mp3dl-main/playlist_fetcher.py /app/vendor/
COPY services/music-import/worker.py services/music-import/bridge.py /app/
ENV MP3DL_DIR=/app/vendor IMPORT_DATA_DIR=/data PYTHONUNBUFFERED=1
RUN useradd --uid 10001 --create-home importer && mkdir /data && chown importer:importer /data
USER importer
EXPOSE 8000
CMD ["uvicorn", "worker:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
