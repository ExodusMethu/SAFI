#!/usr/bin/env python3
"""
mp3dl.py — YouTube to MP3 Downloader
--------------------------------------
Usage:
    python mp3dl.py "Song Name - Artist"
    python mp3dl.py  (interactive mode — prompts for song name)

Requirements:
    pip install yt-dlp
    ffmpeg — auto-detected or auto-downloaded on first run
"""

import sys
import os
import re
import shutil
import zipfile
import urllib.request
import argparse

# Ensure UTF-8 output encoding for Windows terminals
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ── Dependency check ────────────────────────────────────────────────────────

try:
    import yt_dlp
except ImportError:
    print("[ERROR] yt-dlp is not installed. Run:  pip install yt-dlp")
    sys.exit(1)


# ── FFmpeg auto-detection / auto-download ────────────────────────────────────

# Common locations winget installs ffmpeg on Windows
_WINGET_FFMPEG_HINTS = [
    r"C:\ProgramData\Microsoft\WinGet\Packages",
    r"C:\Program Files\ffmpeg\bin",
    r"C:\ffmpeg\bin",
]

# Bundled ffmpeg folder next to this script
_BUNDLED_FFMPEG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ffmpeg_bin")

# ffmpeg Windows build from GitHub releases (small essential build)
_FFMPEG_DOWNLOAD_URL = (
    "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/"
    "latest/ffmpeg-master-latest-win64-gpl.zip"
)


def _find_ffmpeg() -> str:
    """Return the directory containing ffmpeg.exe, or empty string if not found."""
    # 1. Already on PATH?
    if shutil.which("ffmpeg"):
        return ""  # empty string = yt-dlp uses PATH

    # 2. Already bundled next to script?
    if os.path.isfile(os.path.join(_BUNDLED_FFMPEG_DIR, "ffmpeg.exe")):
        return _BUNDLED_FFMPEG_DIR

    # 3. Common winget install paths
    for base in _WINGET_FFMPEG_HINTS:
        if not os.path.isdir(base):
            continue
        for root, dirs, files in os.walk(base):
            if "ffmpeg.exe" in files:
                return root

    return None  # not found


def _download_ffmpeg() -> str:
    """Download a minimal ffmpeg build and unpack next to this script."""
    zip_path = os.path.join(_BUNDLED_FFMPEG_DIR, "ffmpeg.zip")
    os.makedirs(_BUNDLED_FFMPEG_DIR, exist_ok=True)

    print("\n FFmpeg not found — downloading a bundled copy (~80 MB), please wait...")
    try:
        urllib.request.urlretrieve(_FFMPEG_DOWNLOAD_URL, zip_path,
            reporthook=lambda b, bs, t: print(
                f"   {min(b*bs, t)/(1024*1024):.1f} / {t/(1024*1024):.1f} MB\r", end=""))
    except Exception as exc:
        print(f"\n[ERROR] Could not download ffmpeg: {exc}")
        print("  Please install ffmpeg manually: https://ffmpeg.org/download.html")
        sys.exit(1)

    print("\n Unpacking...")
    with zipfile.ZipFile(zip_path, "r") as zf:
        # The zip contains a top-level folder; find ffmpeg.exe inside it
        for member in zf.namelist():
            if member.endswith("ffmpeg.exe") or member.endswith("ffprobe.exe"):
                # Flatten into _BUNDLED_FFMPEG_DIR
                target = os.path.join(_BUNDLED_FFMPEG_DIR, os.path.basename(member))
                with zf.open(member) as src, open(target, "wb") as dst:
                    dst.write(src.read())

    os.remove(zip_path)
    print(f" FFmpeg saved to: {_BUNDLED_FFMPEG_DIR}")
    return _BUNDLED_FFMPEG_DIR


def ensure_ffmpeg() -> str:
    """Return the ffmpeg binary directory (or '' for PATH), downloading if needed."""
    loc = _find_ffmpeg()
    if loc is None:
        loc = _download_ffmpeg()
    return loc


# ── Helpers ──────────────────────────────────────────────────────────────────

def sanitize_filename(name: str) -> str:
    """Remove characters that are illegal in Windows/Linux filenames."""
    return re.sub(r'[<>:"/\\|?*]', "_", name).strip()


def search_youtube(query: str, max_results: int = 5) -> list:
    """
    Search YouTube for `query` and return up to `max_results` entries.
    Each entry has: title, url, duration, uploader.
    """
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "default_search": "ytsearch",
    }

    search_query = f"ytsearch{max_results}:{query}"

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(search_query, download=False)

    results = []
    for entry in info.get("entries", []):
        duration_s = entry.get("duration") or 0
        minutes, seconds = divmod(int(duration_s), 60)
        results.append({
            "title":    entry.get("title", "Unknown"),
            "url":      f"https://www.youtube.com/watch?v={entry['id']}",
            "duration": f"{minutes}:{seconds:02d}",
            "uploader": entry.get("uploader", "Unknown"),
        })
    return results


def pick_result(results: list) -> dict:
    """Display search results and let the user choose one."""
    if not results:
        print("[ERROR] No results found.")
        return None

    print("\n── Search Results ───────────────────────────────────────────────")
    for i, r in enumerate(results, start=1):
        print(f"  [{i}] {r['title']}")
        print(f"       Uploader: {r['uploader']}  |  Duration: {r['duration']}")
        print(f"       URL: {r['url']}")
        print()

    while True:
        choice = input(f"Select a result [1-{len(results)}] (or 0 to cancel): ").strip()
        if choice == "0":
            return None
        if choice.isdigit() and 1 <= int(choice) <= len(results):
            return results[int(choice) - 1]
        print(f"  Please enter a number between 0 and {len(results)}.")


def download_mp3(url: str, output_dir: str, filename_hint: str = None, audio_format: str = "mp3", ydl_options: dict = None) -> str:
    """
    Download audio from `url`, convert to `audio_format`, and save to `output_dir`.
    Returns the final file path, or None on failure.
    """
    os.makedirs(output_dir, exist_ok=True)

    if filename_hint:
        outtmpl = os.path.join(output_dir, sanitize_filename(filename_hint) + ".%(ext)s")
    else:
        outtmpl = os.path.join(output_dir, "%(title)s.%(ext)s")

    ffmpeg_loc = ensure_ffmpeg()

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": audio_format,
                "preferredquality": "320" if audio_format == "mp3" else None,
            }
        ],
        "quiet": False,
        # Suppress the JS-runtime deprecation noise
        "no_warnings": False,
        "extractor_args": {"youtube": {"skip": ["hls", "dash"]}},
    }
    if ffmpeg_loc:
        ydl_opts["ffmpeg_location"] = ffmpeg_loc
    if ydl_options:
        ydl_opts.update(ydl_options)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            prepared = ydl.prepare_filename(info)
            audio_path = os.path.splitext(prepared)[0] + f".{audio_format}"
            return audio_path
    except yt_dlp.utils.DownloadError as exc:
        print(f"[ERROR] Download failed: {exc}")
        return None


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Search YouTube for a song, choose a result, and download it as MP3."
    )
    parser.add_argument(
        "song",
        nargs="*",
        help="Song name (e.g. 'Bohemian Rhapsody Queen'). Leave blank for interactive prompt.",
    )
    parser.add_argument(
        "-o", "--output",
        default=os.path.join(os.path.expanduser("~"), "Music", "Downloads"),
        help="Output directory (default: ~/Music/Downloads)",
    )
    parser.add_argument(
        "-n", "--results",
        type=int,
        default=5,
        help="Number of search results to show (default: 5)",
    )
    parser.add_argument(
        "--auto",
        action="store_true",
        help="Automatically pick the first result without prompting.",
    )
    args = parser.parse_args()

    # ── Get song query ────────────────────────────────────────────────────────
    if args.song:
        query = " ".join(args.song)
    else:
        query = input("Enter song name / artist: ").strip()
        if not query:
            print("[ERROR] No song name provided.")
            sys.exit(1)

    # ── Check if query is a playlist URL or batch text file ──────────────────
    if query.startswith("http://") or query.startswith("https://"):
        try:
            import playlist_fetcher
            if playlist_fetcher.is_spotify_url(query) or playlist_fetcher.is_youtube_url(query):
                print(f"\n Detect playlist URL: {query}")
                playlist_data = playlist_fetcher.fetch_playlist(query)
                tracks = playlist_data.get("tracks", [])
                print(f" Found Playlist: \"{playlist_data.get('title')}\" ({len(tracks)} tracks)")
                
                safe_title = sanitize_filename(playlist_data.get('title', 'Playlist'))
                out_folder = os.path.join(args.output, safe_title)
                os.makedirs(out_folder, exist_ok=True)
                
                # Save list to playlist folder as well
                list_file = os.path.join(out_folder, "songs.txt")
                playlist_fetcher.save_playlist_to_file(playlist_data, list_file)
                print(f" Playlist track list saved to: {list_file}\n")
                
                download_all = args.auto
                if not download_all:
                    ans = input(f"Download all {len(tracks)} songs to '{out_folder}'? [Y/n]: ").strip().lower()
                    download_all = ans in ("", "y", "yes")

                if download_all:
                    success_count = 0
                    for idx, t in enumerate(tracks, 1):
                        q = t["query"]
                        print(f"\n[{idx}/{len(tracks)}] Searching: \"{q}\"")
                        s_results = search_youtube(q, max_results=5)
                        if s_results:
                            for ch in s_results:
                                print(f" Downloading: {ch['title']}")
                                dl = download_mp3(ch["url"], out_folder, filename_hint=q)
                                if dl:
                                    success_count += 1
                                    break
                                else:
                                    print(f" [!] Download failed, trying next result...")
                        else:
                            print(f" [!] No YouTube match found for: {q}")
                    print(f"\n Finished! Downloaded {success_count}/{len(tracks)} songs to: {out_folder}")
                sys.exit(0)
        except Exception as exc:
            print(f"[NOTE] Playlist handler skipped: {exc}")

    # Check if query points to a text file list
    if os.path.isfile(query) and (query.endswith(".txt") or query.endswith(".json")):
        print(f"\n Batch download file detected: {query}")
        with open(query, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip() and not line.startswith("#")]
        print(f" Found {len(lines)} songs to download.\n")
        success_count = 0
        for idx, q in enumerate(lines, 1):
            print(f"[{idx}/{len(lines)}] Processing: \"{q}\"")
            s_results = search_youtube(q, max_results=5)
            if s_results:
                for ch in s_results:
                    dl = download_mp3(ch["url"], args.output, filename_hint=q)
                    if dl:
                        success_count += 1
                        break
                    else:
                        print(f" [!] Download failed, trying next result...")
            else:
                print(f" [!] No match found for: {q}")
        print(f"\n Batch complete! Downloaded {success_count}/{len(lines)} songs.")
        sys.exit(0)

    print(f"\n Searching YouTube for: \"{query}\"")
    results = search_youtube(query, max_results=args.results)

    if not results:
        sys.exit(1)

    # ── Pick a result ─────────────────────────────────────────────────────────
    if args.auto:
        for chosen in results:
            print(f"\n Auto-selected: {chosen['title']}")
            print(f"\n Downloading: {chosen['title']}")
            print(f"    URL: {chosen['url']}")
            print(f"    Output folder: {args.output}\n")

            mp3_path = download_mp3(
                url=chosen["url"],
                output_dir=args.output,
                filename_hint=chosen["title"],
            )

            if mp3_path and os.path.isfile(mp3_path):
                print(f"\n Done!  Saved to: {mp3_path}")
                sys.exit(0)
            else:
                possible = [f for f in os.listdir(args.output) if f.endswith(".mp3")]
                if possible:
                    newest = max(possible, key=lambda f: os.path.getmtime(os.path.join(args.output, f)))
                    print(f"\n Done!  Saved to: {os.path.join(args.output, newest)}")
                    sys.exit(0)
                else:
                    print(f" [!] Download failed, trying next result...")
        
        print("\n Download failed for all results.")
        sys.exit(1)
    else:
        chosen = pick_result(results)
        if chosen is None:
            print("Cancelled.")
            sys.exit(0)

        # ── Download ──────────────────────────────────────────────────────────────
        print(f"\n Downloading: {chosen['title']}")
        print(f"    URL: {chosen['url']}")
        print(f"    Output folder: {args.output}\n")

        mp3_path = download_mp3(
            url=chosen["url"],
            output_dir=args.output,
            filename_hint=chosen["title"],
        )

        if mp3_path and os.path.isfile(mp3_path):
            print(f"\n Done!  Saved to: {mp3_path}")
        else:
            possible = [f for f in os.listdir(args.output) if f.endswith(".mp3")]
            if possible:
                newest = max(possible, key=lambda f: os.path.getmtime(os.path.join(args.output, f)))
                print(f"\n Done!  Saved to: {os.path.join(args.output, newest)}")
            else:
                print("\n Download failed.")
                sys.exit(1)


if __name__ == "__main__":
    main()
