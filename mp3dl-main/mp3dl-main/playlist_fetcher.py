#!/usr/bin/env python3
"""
playlist_fetcher.py — Fetch Spotify & YouTube Music Playlists
----------------------------------------------------------------
Fetches song titles and artists from Spotify and YouTube / YouTube Music playlist links,
saves them to a text or JSON list, and can optionally batch-download them as MP3s.

Usage:
    python playlist_fetcher.py "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
    python playlist_fetcher.py "https://music.youtube.com/playlist?list=PL..." --download
    python playlist_fetcher.py "playlist_url" -o my_songs.txt
"""

import sys
import os
import re
import json
import urllib.request
import urllib.parse
import argparse
from typing import List, Dict, Tuple, Optional

# Ensure UTF-8 output encoding for Windows terminals
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    import yt_dlp
except ImportError:
    print("[ERROR] yt-dlp is not installed. Run: pip install yt-dlp")
    sys.exit(1)


# Optional Spotipy import
try:
    import spotipy
    from spotipy.oauth2 import SpotifyClientCredentials
    HAS_SPOTIPY = True
except ImportError:
    HAS_SPOTIPY = False


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def is_spotify_url(url: str) -> bool:
    """Check if the URL is a Spotify playlist, album, or track link."""
    return "spotify.com" in url.lower() and (
        "playlist" in url.lower() or "album" in url.lower() or "track" in url.lower()
    )


def is_youtube_url(url: str) -> bool:
    """Check if the URL is a YouTube or YouTube Music playlist link."""
    return ("youtube.com" in url.lower() or "youtu.be" in url.lower()) and (
        "list=" in url.lower() or "playlist" in url.lower()
    )


# ── Spotify Extraction ───────────────────────────────────────────────────────

def _extract_spotify_id(url: str) -> Tuple[Optional[str], Optional[str]]:
    """Extract (item_type, item_id) from a Spotify URL."""
    match = re.search(r"spotify\.com/(playlist|album|track)/([a-zA-Z0-9]+)", url)
    if match:
        return match.group(1), match.group(2)
    return None, None


def fetch_spotify_playlist_spotipy(item_type: str, item_id: str) -> Optional[Dict]:
    """Fetch Spotify playlist/album using official spotipy library if credentials exist."""
    client_id = os.getenv("SPOTIPY_CLIENT_ID")
    client_secret = os.getenv("SPOTIPY_CLIENT_SECRET")
    if not (HAS_SPOTIPY and client_id and client_secret):
        return None

    try:
        sp = spotipy.Spotify(
            auth_manager=SpotifyClientCredentials(
                client_id=client_id, client_secret=client_secret
            )
        )
        tracks = []
        playlist_title = "Spotify Playlist"

        if item_type == "playlist":
            results = sp.playlist_items(item_id)
            playlist_info = sp.playlist(item_id, fields="name")
            playlist_title = playlist_info.get("name", "Spotify Playlist")

            while results:
                for item in results.get("items", []):
                    track = item.get("track")
                    if track and track.get("name"):
                        artists = ", ".join([a["name"] for a in track.get("artists", [])])
                        tracks.append({
                            "title": track["name"],
                            "artist": artists,
                            "query": f"{artists} - {track['name']}",
                            "album": track.get("album", {}).get("name", ""),
                            "duration_ms": track.get("duration_ms", 0),
                        })
                if results.get("next"):
                    results = sp.next(results)
                else:
                    break

        elif item_type == "album":
            results = sp.album_tracks(item_id)
            album_info = sp.album(item_id)
            playlist_title = album_info.get("name", "Spotify Album")

            while results:
                for track in results.get("items", []):
                    if track and track.get("name"):
                        artists = ", ".join([a["name"] for a in track.get("artists", [])])
                        tracks.append({
                            "title": track["name"],
                            "artist": artists,
                            "query": f"{artists} - {track['name']}",
                            "album": playlist_title,
                            "duration_ms": track.get("duration_ms", 0),
                        })
                if results.get("next"):
                    results = sp.next(results)
                else:
                    break

        return {"title": playlist_title, "tracks": tracks, "source": "Spotify (API)"}
    except Exception as exc:
        print(f"[DEBUG] Spotipy fetch failed: {exc}")
        return None


def fetch_spotify_playlist_web(item_type: str, item_id: str) -> Dict:
    """
    Fetch public Spotify playlist/album without requiring API keys by parsing Spotify's public embed page.
    """
    embed_url = f"https://open.spotify.com/embed/{item_type}/{item_id}"
    req = urllib.request.Request(embed_url, headers={"User-Agent": USER_AGENT})

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8")
    except Exception as exc:
        raise RuntimeError(f"Could not connect to Spotify embed page: {exc}")

    # Extract JSON inside <script id="__NEXT_DATA__" type="application/json">
    next_data_match = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html,
        re.DOTALL,
    )

    tracks = []
    playlist_title = f"Spotify {item_type.capitalize()}"

    # Extract title from meta tags or title tag
    og_title_match = re.search(r'<meta property="og:title" content="([^"]+)"', html) or re.search(r'<title>(.*?)</title>', html)
    if og_title_match:
        playlist_title = og_title_match.group(1).replace(" - playlist by", "").replace(" | Spotify", "").strip()

    if next_data_match:
        try:
            data = json.loads(next_data_match.group(1))
            props = data.get("props", {}).get("pageProps", {})
            state = props.get("state", {}) or props.get("initialState", {})

            # Try parsing entity data
            entity = props.get("entity", {}) or state.get("data", {})
            if not entity:
                entity = props

            extracted_name = entity.get("title") or entity.get("name")
            if extracted_name and isinstance(extracted_name, str):
                playlist_title = extracted_name

            # Spotify Embed page JSON structures can vary:
            track_list = entity.get("trackList") or entity.get("tracks", [])
            if isinstance(track_list, dict):
                track_list = track_list.get("items", [])

            for tr in track_list:
                title = tr.get("title") or tr.get("name")
                artist = tr.get("subtitle") or tr.get("artist") or ""
                if not artist and tr.get("artists"):
                    artist = ", ".join(
                        [a.get("name", "") for a in tr["artists"] if isinstance(a, dict)]
                    )

                if title:
                    # Ignore playlist header entry if it matches playlist title or artist contains Spotify
                    if ("spotify" in artist.lower() or title.lower() == playlist_title.lower()) and len(track_list) > 1:
                        continue
                    query = f"{artist} - {title}" if artist else title
                    tracks.append({
                        "title": title,
                        "artist": artist,
                        "query": query,
                    })

        except Exception as exc:
            print(f"[DEBUG] Error parsing __NEXT_DATA__: {exc}")

    # Fallback pattern extraction if __NEXT_DATA__ was missing or yielded no tracks
    if not tracks:
        matches = re.findall(
            r'"title"\s*:\s*"([^"]+)"\s*,\s*"subtitle"\s*:\s*"([^"]+)"', html
        )
        for title, subtitle in matches:
            query = f"{subtitle} - {title}" if subtitle else title
            entry = {"title": title, "artist": subtitle, "query": query}
            if entry not in tracks:
                tracks.append(entry)

    if not tracks:
        raise RuntimeError(
            "No tracks found in Spotify playlist/album. Verify the playlist is public."
        )

    return {"title": playlist_title, "tracks": tracks, "source": "Spotify (Web)"}


def fetch_spotify_playlist(url: str) -> Dict:
    """Fetch Spotify tracks using Spotipy API if available, else public web scraper."""
    item_type, item_id = _extract_spotify_id(url)
    if not item_type or not item_id:
        raise ValueError(f"Invalid Spotify URL format: {url}")

    # 1. Try Spotipy (API)
    res = fetch_spotify_playlist_spotipy(item_type, item_id)
    if res and res.get("tracks"):
        return res

    # 2. Fallback to Web Scraper (Zero-setup)
    return fetch_spotify_playlist_web(item_type, item_id)


# ── YouTube / YouTube Music Extraction ────────────────────────────────────────

# Optional ytmusicapi import
try:
    import ytmusicapi
    HAS_YTMUSICAPI = True
except ImportError:
    HAS_YTMUSICAPI = False


def _extract_youtube_playlist_id(url: str) -> Optional[str]:
    """Extract playlist ID parameter from a YouTube/YouTube Music URL."""
    match = re.search(r"list=([a-zA-Z0-9_-]+)", url)
    if match:
        return match.group(1)
    return None


def fetch_youtube_playlist_ytmusicapi(playlist_id: str, max_tracks: int = None) -> Optional[Dict]:
    """Fetch YouTube Music playlist using ytmusicapi."""
    if not HAS_YTMUSICAPI:
        return None

    try:
        ytm = ytmusicapi.YTMusic()
        res = ytm.get_playlist(playlist_id, limit=max_tracks)
        if not res or not res.get("tracks"):
            return None

        playlist_title = res.get("title", "YouTube Music Playlist")
        tracks = []

        for item in res.get("tracks", []):
            title = item.get("title") or "Unknown Title"
            artists_list = item.get("artists") or []
            artist = ", ".join([a["name"] for a in artists_list if isinstance(a, dict) and a.get("name")])
            if not artist and item.get("byline"):
                artist = item.get("byline")

            query = f"{artist} - {title}" if artist and artist.lower() not in title.lower() else title
            videoId = item.get("videoId")

            tracks.append({
                "title": title,
                "artist": artist,
                "query": query,
                "duration": item.get("duration", "N/A"),
                "url": f"https://www.youtube.com/watch?v={videoId}" if videoId else "",
            })

        return {"title": playlist_title, "tracks": tracks, "source": "YouTube Music (API)"}
    except Exception as exc:
        err_str = str(exc).lower()
        if "noindex" in err_str or "contents" in err_str:
            raise RuntimeError(
                "This YouTube Music playlist appears to be Private or Private/Unlisted. "
                "Please change the playlist privacy to Public or Unlisted on YouTube Music and try again."
            )
        print(f"[DEBUG] ytmusicapi fetch failed: {exc}")
        return None


def fetch_youtube_playlist(url: str, max_tracks: int = None) -> Dict:
    """
    Fetch tracks from a YouTube Music or YouTube playlist using ytmusicapi or yt-dlp.
    """
    playlist_id = _extract_youtube_playlist_id(url)
    
    # 1. Try ytmusicapi first for YouTube Music playlists
    if playlist_id:
        try:
            res = fetch_youtube_playlist_ytmusicapi(playlist_id, max_tracks=max_tracks)
            if res and res.get("tracks"):
                return res
        except RuntimeError as exc:
            raise exc
        except Exception:
            pass

    # 2. Fallback to yt-dlp flat extraction
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "skip_download": True,
        "ignoreerrors": True,
        "socket_timeout": 30,
        "retries": 2,
    }
    if max_tracks:
        ydl_opts["playlistend"] = max_tracks

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as exc:
        err_msg = str(exc)
        if "403" in err_msg or "Forbidden" in err_msg:
            raise RuntimeError(
                "Could not access playlist (HTTP 403 Forbidden). "
                "If this is a YouTube playlist, please verify that it is set to Public or Unlisted."
            )
        raise RuntimeError(f"Could not extract playlist information from {url}: {exc}")

    if not info:
        raise RuntimeError(
            f"Could not extract playlist information from {url}. "
            "Please verify that the playlist URL is correct and public."
        )

    playlist_title = info.get("title", "YouTube Playlist")
    raw_entries = info.get("entries", [])
    tracks = []

    for entry in raw_entries:
        if not entry:
            continue

        title = entry.get("title") or entry.get("track") or "Unknown Title"
        artist = (
            entry.get("artist")
            or entry.get("uploader")
            or entry.get("channel")
            or ""
        )

        if " - " in title and not artist:
            query = title
            parts = title.split(" - ", 1)
            artist = parts[0]
            title = parts[1]
        elif artist and artist.lower() not in title.lower():
            query = f"{artist} - {title}"
        else:
            query = title

        duration_s = entry.get("duration") or 0
        minutes, seconds = divmod(int(duration_s), 60)
        duration_str = f"{minutes}:{seconds:02d}" if duration_s else "N/A"

        tracks.append({
            "title": title,
            "artist": artist,
            "query": query,
            "duration": duration_str,
            "url": (
                entry.get("url")
                or (f"https://www.youtube.com/watch?v={entry.get('id')}" if entry.get("id") else "")
            ),
        })

    if not tracks:
        raise RuntimeError(
            "No tracks found in YouTube playlist. Please check that the playlist is not empty and is set to Public or Unlisted."
        )

    return {"title": playlist_title, "tracks": tracks, "source": "YouTube Music / YouTube"}


# ── General Fetcher Entry Point ──────────────────────────────────────────────

def fetch_playlist(url: str) -> Dict:
    """Auto-detect URL type and return playlist details with track list."""
    if is_spotify_url(url):
        return fetch_spotify_playlist(url)
    elif is_youtube_url(url):
        return fetch_youtube_playlist(url)
    else:
        try:
            return fetch_youtube_playlist(url)
        except Exception:
            raise ValueError(
                "URL is not recognized as a supported Spotify or YouTube Music playlist."
            )


# ── File Saver Helpers ────────────────────────────────────────────────────────

def save_playlist_to_file(
    playlist_data: Dict, output_path: str, format_type: str = "txt"
) -> str:
    """Save playlist tracks to a text file or JSON file."""
    output_abs = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_abs), exist_ok=True)
    tracks = playlist_data.get("tracks", [])

    if format_type.lower() == "json":
        with open(output_abs, "w", encoding="utf-8") as f:
            json.dump(playlist_data, f, indent=2, ensure_ascii=False)
    else:
        with open(output_abs, "w", encoding="utf-8") as f:
            f.write(f"# Playlist: {playlist_data.get('title', 'Playlist')}\n")
            f.write(f"# Total Songs: {len(tracks)}\n\n")
            for t in tracks:
                f.write(f"{t['query']}\n")

    return output_abs


# ── CLI & Main ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Fetch all song names from a Spotify or YouTube Music playlist and save to a download list."
    )
    parser.add_argument(
        "url",
        help="Spotify or YouTube Music Playlist / Album URL",
    )
    parser.add_argument(
        "-o", "--output",
        default="playlist_songs.txt",
        help="Path to output file (default: playlist_songs.txt)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Save playlist output in JSON format instead of text.",
    )
    parser.add_argument(
        "-d", "--download",
        action="store_true",
        help="Automatically download all extracted songs using mp3dl downloader.",
    )
    parser.add_argument(
        "--download-dir",
        default=os.path.join(os.path.expanduser("~"), "Music", "Downloads"),
        help="Directory to save downloaded MP3 files.",
    )

    args = parser.parse_args()

    print(f"\n🔍 Fetching playlist from: {args.url}")
    try:
        data = fetch_playlist(args.url)
    except Exception as exc:
        print(f"\n[ERROR] Failed to fetch playlist: {exc}")
        sys.exit(1)

    tracks = data.get("tracks", [])
    print(f"\n✅ Playlist Found: \"{data.get('title')}\" ({data.get('source')})")
    print(f"🎵 Total Songs Extracted: {len(tracks)}\n")

    for i, t in enumerate(tracks[:10], 1):
        print(f"  {i:2d}. {t['query']}")
    if len(tracks) > 10:
        print(f"  ... and {len(tracks) - 10} more songs.")

    # Save to file
    fmt = "json" if args.json else "txt"
    saved_file = save_playlist_to_file(data, args.output, format_type=fmt)
    print(f"\n📄 Saved song list to: {saved_file}")

    # Batch download if requested
    if args.download:
        print(f"\n🚀 Starting batch download of {len(tracks)} songs...")
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        import mp3dl

        safe_title = mp3dl.sanitize_filename(data.get('title', 'Playlist'))
        out_folder = os.path.join(args.download_dir, safe_title)
        os.makedirs(out_folder, exist_ok=True)

        success_count = 0
        fail_count = 0

        for idx, t in enumerate(tracks, 1):
            query = t["query"]
            print(f"\n[{idx}/{len(tracks)}] Processing: \"{query}\"")
            search_res = mp3dl.search_youtube(query, max_results=1)
            if not search_res:
                print(f"   [!] No YouTube match found for: {query}")
                fail_count += 1
                continue

            chosen = search_res[0]
            print(f"   Downloading: {chosen['title']}")
            dl_path = mp3dl.download_mp3(chosen["url"], out_folder, filename_hint=t["query"])
            if dl_path:
                print(f"   Done -> {os.path.basename(dl_path)}")
                success_count += 1
            else:
                fail_count += 1

        print(f"\n🎉 Batch Download Complete!")
        print(f"   Successfully downloaded: {success_count} MP3s")
        if fail_count > 0:
            print(f"   Failed: {fail_count} songs")
        print(f"   Saved to folder: {out_folder}")


if __name__ == "__main__":
    main()
