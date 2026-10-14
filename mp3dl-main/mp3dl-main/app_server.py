#!/usr/bin/env python3
"""
app_server.py — Local Web Backend Server for MP3DL & Playlist Fetcher
----------------------------------------------------------------------
Runs a lightweight, zero-dependency HTTP server that serves the UI frontend
and exposes API endpoints for searching, playlist fetching, and MP3 downloading.
"""

import sys
import os
import json
import threading
import urllib.parse
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from typing import Dict, List, Any

# Ensure UTF-8 stdout
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Import core modules
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(SCRIPT_DIR)

import mp3dl
import playlist_fetcher

PORT = 5000
WEB_DIR = os.path.join(SCRIPT_DIR, "web")
DEFAULT_DOWNLOAD_DIR = os.path.join(os.path.expanduser("~"), "Music", "Downloads")

# ── Global Download Task Manager State ────────────────────────────────────────

class DownloadManager:
    def __init__(self):
        self.lock = threading.Lock()
        self.active = False
        self.current_track = ""
        self.current_index = 0
        self.total_tracks = 0
        self.completed = 0
        self.failed = 0
        self.status = "idle"  # idle, downloading, complete, cancelled
        self.logs = []
        self.download_dir = DEFAULT_DOWNLOAD_DIR

    def log(self, message: str):
        with self.lock:
            self.logs.append(message)
            if len(self.logs) > 200:
                self.logs.pop(0)

    def get_state(self) -> Dict[str, Any]:
        with self.lock:
            return {
                "active": self.active,
                "current_track": self.current_track,
                "current_index": self.current_index,
                "total_tracks": self.total_tracks,
                "completed": self.completed,
                "failed": self.failed,
                "status": self.status,
                "logs": self.logs[-20:],
                "download_dir": self.download_dir,
            }

    def start_batch_download(self, tracks: List[Dict[str, str]], download_dir: str, playlist_title: str = None, audio_format: str = "mp3"):
        with self.lock:
            if self.active:
                return False
            self.active = True
            self.status = "downloading"
            self.current_index = 0
            self.total_tracks = len(tracks)
            self.completed = 0
            self.failed = 0
            self.logs = []
            
            if playlist_title:
                safe_folder = mp3dl.sanitize_filename(playlist_title)
                self.download_dir = os.path.join(download_dir, safe_folder)
            else:
                self.download_dir = download_dir
                
            os.makedirs(self.download_dir, exist_ok=True)

        thread = threading.Thread(
            target=self._run_downloads,
            args=(tracks, audio_format),
            daemon=True
        )
        thread.start()
        return True

    def _run_downloads(self, tracks: List[Dict[str, str]], audio_format: str):
        self.log(f"🚀 Starting download batch of {len(tracks)} tracks ({audio_format.upper()})...")
        self.log(f"📁 Save location: {self.download_dir}")

        for idx, t in enumerate(tracks, 1):
            with self.lock:
                if self.status == "cancelled":
                    self.log("⚠️ Download cancelled by user.")
                    break
                self.current_index = idx
                query = t.get("query") or f"{t.get('artist', '')} - {t.get('title', '')}".strip(" -")
                self.current_track = query

            self.log(f"[{idx}/{len(tracks)}] Searching YouTube for: \"{query}\"")
            search_res = mp3dl.search_youtube(query, max_results=1)

            if not search_res:
                self.log(f"❌ No YouTube match found for: {query}")
                with self.lock:
                    self.failed += 1
                continue

            chosen = search_res[0]
            self.log(f"⬇️ Downloading: {chosen['title']}")

            dl_path = mp3dl.download_mp3(
                url=chosen["url"],
                output_dir=self.download_dir,
                filename_hint=query,
                audio_format=audio_format
            )

            if dl_path and os.path.isfile(dl_path):
                self.log(f"✅ Downloaded: {os.path.basename(dl_path)}")
                with self.lock:
                    self.completed += 1
            else:
                self.log(f"❌ Failed to download: {query}")
                with self.lock:
                    self.failed += 1

        with self.lock:
            self.active = False
            self.status = "complete"
            self.log(f"🎉 Batch complete! Successfully downloaded {self.completed}/{len(tracks)} songs.")


download_manager = DownloadManager()


# ── HTTP API Request Handler ──────────────────────────────────────────────────

class AppRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def _send_json(self, data: Any, status_code: int = 200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url_path = urllib.parse.urlparse(self.path).path

        if url_path == "/api/progress":
            self._send_json(download_manager.get_state())
        elif url_path == "/api/default-folder":
            self._send_json({"folder": DEFAULT_DOWNLOAD_DIR})
        else:
            super().do_GET()

    def do_POST(self):
        url_path = urllib.parse.urlparse(self.path).path
        content_length = int(self.headers.get("Content-Length", 0))
        body_data = self.rfile.read(content_length)

        try:
            payload = json.loads(body_data.decode("utf-8")) if body_data else {}
        except Exception:
            payload = {}

        if url_path == "/api/fetch-playlist":
            url = payload.get("url", "").strip()
            if not url:
                self._send_json({"error": "Please provide a valid URL."}, status_code=400)
                return

            try:
                result = playlist_fetcher.fetch_playlist(url)
                self._send_json(result)
            except Exception as exc:
                self._send_json({"error": str(exc)}, status_code=500)

        elif url_path == "/api/search":
            query = payload.get("query", "").strip()
            if not query:
                self._send_json({"error": "Please provide a search query."}, status_code=400)
                return

            try:
                results = mp3dl.search_youtube(query, max_results=10)
                self._send_json({"results": results})
            except Exception as exc:
                self._send_json({"error": str(exc)}, status_code=500)

        elif url_path == "/api/download-tracks":
            tracks = payload.get("tracks", [])
            output_dir = payload.get("output_dir") or DEFAULT_DOWNLOAD_DIR
            playlist_title = payload.get("playlist_title")
            audio_format = payload.get("audio_format", "mp3")

            if not tracks:
                self._send_json({"error": "No tracks provided to download."}, status_code=400)
                return

            started = download_manager.start_batch_download(
                tracks=tracks,
                download_dir=output_dir,
                playlist_title=playlist_title,
                audio_format=audio_format
            )

            if started:
                self._send_json({"message": "Download started", "total": len(tracks)})
            else:
                self._send_json({"error": "A download task is already running."}, status_code=409)

        elif url_path == "/api/open-folder":
            folder = payload.get("path") or download_manager.download_dir
            if os.path.exists(folder):
                try:
                    os.startfile(folder)
                    self._send_json({"success": True})
                except Exception as exc:
                    self._send_json({"error": str(exc)}, status_code=500)
            else:
                os.makedirs(folder, exist_ok=True)
                os.startfile(folder)
                self._send_json({"success": True})

        else:
            self._send_json({"error": "API endpoint not found"}, status_code=404)


# ── Server Launcher ───────────────────────────────────────────────────────────

def run_server():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, AppRequestHandler)
    print(f"\n=======================================================")
    print(f" 🎵 MP3DL Web UI Server is running!")
    print(f" 🌐 Access UI at: http://localhost:{PORT}")
    print(f"=======================================================\n")
    
    # Open browser automatically
    webbrowser.open(f"http://localhost:{PORT}")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n Server shutting down...")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
