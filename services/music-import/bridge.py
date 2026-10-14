"""Run the supplied MP3DL modules in a bounded child process."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
VENDOR = Path(os.getenv('MP3DL_DIR', str(ROOT.parents[1] / 'mp3dl-main' / 'mp3dl-main')))
sys.path.insert(0, str(VENDOR))


def main():
    import mp3dl
    import playlist_fetcher

    action, value, directory, output = sys.argv[1:]
    if action == 'playlist':
        result = playlist_fetcher.fetch_youtube_playlist(value, max_tracks=int(os.getenv('IMPORT_MAX_TRACKS', '200')) + 1)
    else:
        if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
            raise RuntimeError('Install FFmpeg and ffprobe on the worker.')
        path = mp3dl.download_mp3(value, directory, filename_hint='track', ydl_options={
            'noplaylist': True, 'socket_timeout': 30, 'retries': 2, 'fragment_retries': 2,
            'max_filesize': 100 * 1024 * 1024,
            'js_runtimes': {'node': {}},
            'match_filter': lambda info, **kwargs: 'Live streams and tracks longer than 30 minutes are unsupported.'
            if info.get('is_live') or (info.get('duration') or 0) > 1800 else None,
        })
        if not path or not Path(path).is_file():
            raise RuntimeError('Download failed.')
        probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                '-of', 'json', path], capture_output=True, text=True,
                               check=True, timeout=15)
        result = {'path': path, 'duration': round(float(json.loads(probe.stdout)['format']['duration']))}
    Path(output).write_text(json.dumps(result), encoding='utf-8')


if __name__ == '__main__':
    main()
