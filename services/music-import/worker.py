"""Private, single-instance playlist import worker. Run behind SAFI's gateway."""
import hmac
import json
import logging
import os
from pathlib import Path
import re
import signal
import sqlite3
import subprocess
import sys
import tempfile
import threading
import unicodedata
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager, contextmanager
from urllib.parse import parse_qs, urlencode, urlparse

import boto3
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import requests

ROOT = Path(__file__).resolve().parent
DATA = Path(os.getenv('IMPORT_DATA_DIR', str(ROOT / 'data')))
JOB_STORE = os.getenv('IMPORT_JOB_STORE', 'sqlite')
MAX_TRACKS = int(os.getenv('IMPORT_MAX_TRACKS', '200'))
MAX_BYTES = 100 * 1024 * 1024
POOL = ThreadPoolExecutor(max_workers=1)
LOCK = threading.Lock()
ACTIVE = ('queued', 'fetching', 'downloading')


def canonical_playlist(value):
    parsed = urlparse(value)
    ids = parse_qs(parsed.query).get('list', [])
    if (parsed.scheme != 'https' or parsed.hostname not in
            ('youtube.com', 'www.youtube.com', 'music.youtube.com') or
            parsed.username or parsed.password or parsed.port not in (None, 443) or
            not ids or not re.fullmatch(r'[A-Za-z0-9_-]{10,150}', ids[0])):
        raise ValueError('Use a public or unlisted YouTube Music playlist link.')
    return 'https://music.youtube.com/playlist?' + urlencode({'list': ids[0]})


def canonical_video(value):
    parsed = urlparse(value or '')
    ids = parse_qs(parsed.query).get('v', [])
    video = ids[0] if ids else (parsed.path.strip('/') if parsed.hostname == 'youtu.be' else '')
    if (parsed.scheme != 'https' or parsed.hostname not in
            ('youtube.com', 'www.youtube.com', 'music.youtube.com', 'youtu.be') or
            not re.fullmatch(r'[A-Za-z0-9_-]{11}', video)):
        raise ValueError('This playlist entry has no valid YouTube video link.')
    return 'https://www.youtube.com/watch?v=' + video


def song_identity(title, artist):
    # Match tagged manual uploads conservatively; do not guess from title alone.
    def clean(value):
        return ' '.join(unicodedata.normalize('NFKC', value or '').casefold().split())
    title, artist = clean(title), clean(artist)
    return (title, artist) if title and artist else None


def existing_songs():
    result = {}
    offset = 0
    while True:
        rows = rest('tracks', params={'select': 'id,title,artist', 'order': 'created_at.asc,id.asc',
                                     'offset': str(offset), 'limit': '500'})
        for row in rows:
            identity = song_identity(row.get('title'), row.get('artist'))
            if identity:
                result.setdefault(identity, row['id'])
        if len(rows) < 500:
            return result
        offset += len(rows)


@contextmanager
def db():
    connection = sqlite3.connect(DATA / 'jobs.sqlite3', timeout=30)
    try:
        with connection:
            connection.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, user_id TEXT, state TEXT, created INTEGER)')
            yield connection
    finally:
        connection.close()


def save(job):
    if JOB_STORE == 'supabase':
        rest('music_import_jobs', 'PATCH', params={'id': 'eq.' + job['id']},
             body={'state': job, 'status': job['status']})
        return
    with db() as connection:
        connection.execute('UPDATE jobs SET state=? WHERE id=?', (json.dumps(job), job['id']))


def latest(user_id, job_id=None):
    if JOB_STORE == 'supabase':
        params = {'user_id': 'eq.' + user_id, 'select': 'state', 'order': 'created_at.desc', 'limit': '1'}
        if job_id:
            params['id'] = 'eq.' + job_id
        rows = rest('music_import_jobs', params=params)
        return rows[0]['state'] if rows else None
    with db() as connection:
        if job_id:
            row = connection.execute('SELECT state FROM jobs WHERE id=? AND user_id=?', (job_id, user_id)).fetchone()
        else:
            row = connection.execute('SELECT state FROM jobs WHERE user_id=? ORDER BY created DESC, rowid DESC LIMIT 1', (user_id,)).fetchone()
    return json.loads(row[0]) if row else None


def active_jobs():
    if JOB_STORE == 'supabase':
        rows = rest('music_import_jobs', params={'status': 'in.(queued,fetching,downloading)', 'select': 'state'})
        return [row['state'] for row in rows]
    with db() as connection:
        rows = connection.execute('SELECT state FROM jobs').fetchall()
    return [job for row in rows if (job := json.loads(row[0]))['status'] in ACTIVE]


def insert_job(job):
    if JOB_STORE == 'supabase':
        rest('music_import_jobs', 'POST', body={
            'id': job['id'], 'user_id': job['user_id'], 'status': job['status'], 'state': job,
        })
        return
    with db() as connection:
        connection.execute('INSERT INTO jobs VALUES (?, ?, ?, unixepoch())',
                           (job['id'], job['user_id'], json.dumps(job)))


def require_secret(request: Request, authorization: str = Header(default='')):
    if request.url.path == '/health':
        return
    secret = os.environ['MUSIC_IMPORT_WORKER_SECRET']
    if not hmac.compare_digest(authorization, 'Bearer ' + secret):
        raise HTTPException(status_code=401, detail='Unauthorized')


class ImportRequest(BaseModel):
    url: str = Field(max_length=2048)
    user_id: uuid.UUID


@asynccontextmanager
async def lifespan(app):
    required = ['MUSIC_IMPORT_WORKER_SECRET', 'NEXT_PUBLIC_SUPABASE_URL',
                'SUPABASE_SERVICE_ROLE_KEY']
    if not os.getenv('IMPORT_UPLOAD_API_URL'):
        required += ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise RuntimeError('Missing settings: ' + ', '.join(missing))
    if JOB_STORE not in ('sqlite', 'supabase'):
        raise RuntimeError('IMPORT_JOB_STORE must be sqlite or supabase.')
    if JOB_STORE == 'sqlite':
        DATA.mkdir(parents=True, exist_ok=True)
    for job in active_jobs():
        job.update(status='failed', error='The worker restarted. Successfully imported tracks were kept; start the playlist again to import the rest.')
        save(job)
    yield
    POOL.shutdown(wait=True)


app = FastAPI(lifespan=lifespan, dependencies=[Depends(require_secret)])


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return JSONResponse({'error': exc.detail}, status_code=exc.status_code)


@app.post('/imports', status_code=202)
def start(payload: ImportRequest):
    try:
        url = canonical_playlist(payload.url)
    except ValueError as error:
        raise HTTPException(400, str(error))
    user_id = str(payload.user_id)
    with LOCK:
        active = active_jobs()
        if any(job['user_id'] == user_id for job in active):
            raise HTTPException(409, 'You already have an import running.')
        if len(active) >= 10:
            raise HTTPException(429, 'The import queue is full. Try again later.')
        job = dict(id=uuid.uuid4().hex, user_id=user_id, url=url, status='queued',
                   title='', total=0, completed=0, reused=0, failed=0,
                   current_track='', errors=[], error=None, playlist_id=None)
        insert_job(job)
        POOL.submit(run, job)
    return job


@app.get('/imports')
def get_latest(user_id: uuid.UUID):
    return latest(str(user_id))


@app.get('/imports/{job_id}')
def get_job(job_id: str, user_id: uuid.UUID):
    job = latest(str(user_id), job_id)
    if not job:
        raise HTTPException(404, 'Import not found.')
    return job


def rest(table, method='GET', params=None, body=None):
    secret = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    base = os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/').removesuffix('/rest/v1')
    response = requests.request(method, f'{base}/rest/v1/{table}', params=params,
                                json=body, timeout=30, headers={
                                    'apikey': secret, 'Authorization': f'Bearer {secret}',
                                    'Prefer': 'return=representation',
                                })
    if not response.ok:
        # Do not expose upstream credentials, URLs or database details to clients.
        logging.error('Database operation failed: %s %s %s', method, table, response.status_code)
        raise RuntimeError('Could not save to the music library. Check the worker configuration and database migration.')
    return response.json() if response.content else []


def bridge(action, value, directory, timeout):
    result = Path(directory) / 'result.json'
    command = [sys.executable, str(ROOT / 'bridge.py'), action, value, str(directory), str(result)]
    options = {'start_new_session': True} if os.name != 'nt' else {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP}
    # Isolate downloader subprocesses from storage/database credentials.
    environment = {key: value for key, value in os.environ.items()
                   if key not in {'MUSIC_IMPORT_WORKER_SECRET', 'SUPABASE_SERVICE_ROLE_KEY',
                                  'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'}}
    process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               env=environment, **options)
    try:
        code = process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        if os.name == 'nt':
            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        else:
            os.killpg(process.pid, signal.SIGKILL)
        process.wait()
        raise
    if code:
        raise subprocess.CalledProcessError(code, command)
    return json.loads(result.read_text(encoding='utf-8'))


def track_error(error):
    if isinstance(error, subprocess.TimeoutExpired):
        return 'Download timed out.'
    if isinstance(error, subprocess.CalledProcessError):
        return 'YouTube could not provide this track. It may be unavailable or require sign-in.'
    if isinstance(error, ValueError):
        return str(error)
    return 'Could not download or save this track. Check the worker logs.'


class AppStorage:
    """Use SAFI's existing storage credentials without copying them to the worker."""
    def __init__(self):
        self.endpoint = os.environ['IMPORT_UPLOAD_API_URL']
        self.headers = {'Authorization': 'Bearer ' + os.environ['MUSIC_IMPORT_WORKER_SECRET']}
        self.keys = {}

    def upload_file(self, path, bucket, key, ExtraArgs=None):
        response = requests.post(self.endpoint, json={'size': Path(path).stat().st_size},
                                 headers=self.headers, timeout=30)
        if not response.ok:
            raise RuntimeError('SAFI could not prepare an upload.')
        upload = response.json()
        self.keys[key] = upload['key']
        with open(path, 'rb') as audio:
            response = requests.put(upload['url'], data=audio,
                                    headers={'Content-Type': 'audio/mpeg'}, timeout=120)
        if not response.ok:
            raise RuntimeError('Audio upload failed.')

    def delete_object(self, Bucket, Key):
        response = requests.delete(self.endpoint, json={'key': self.keys.get(Key, Key)},
                                   headers=self.headers, timeout=30)
        if not response.ok:
            raise RuntimeError('Upload cleanup failed.')

    def stored_key(self, key):
        return self.keys[key]


def run(job):
    try:
        job['status'] = 'fetching'
        save(job)
        with tempfile.TemporaryDirectory(prefix='safi-playlist-') as folder:
            playlist = bridge('playlist', job['url'], folder, 120)
        entries = playlist['tracks']
        if not entries:
            raise ValueError('The playlist has no accessible tracks.')
        if len(entries) > MAX_TRACKS:
            raise ValueError(f'This playlist exceeds the {MAX_TRACKS}-track import limit. Split it into smaller playlists.')
        # Fail before creating a playlist if the source_url migration is missing.
        rest('tracks', params={'select': 'id,source_url', 'limit': '1'})
        songs = existing_songs()
        personal = rest('playlists', 'POST', body={
            'user_id': job['user_id'], 'name': playlist['title'],
            'description': 'Imported from ' + job['url'],
        })[0]
        job.update(title=playlist['title'], total=len(entries), playlist_id=personal['id'], status='downloading')
        save(job)
        s3 = AppStorage() if os.getenv('IMPORT_UPLOAD_API_URL') else boto3.client('s3', endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                          region_name='auto', aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
                          aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'])
        bucket = os.getenv('R2_BUCKET_NAME', '')
        linked = set()
        for position, entry in enumerate(entries):
            job['current_track'] = entry['title']
            save(job)
            try:
                identity = song_identity(entry.get('title'), entry.get('artist'))
                existing = [{'id': songs[identity]}] if identity in songs else []
                source = canonical_video(entry.get('url')) if not existing else None
                if not existing:
                    existing = rest('tracks', params={'source_url': 'eq.' + source, 'select': 'id', 'limit': '1'})
                if existing:
                    track_id = existing[0]['id']
                    reused = True
                else:
                    with tempfile.TemporaryDirectory(prefix='safi-audio-') as folder:
                        audio = bridge('download', source, folder, 600)
                        path = Path(audio['path']).resolve()
                        if not path.is_relative_to(Path(folder).resolve()) or not path.is_file():
                            raise ValueError('The downloader did not produce an audio file.')
                        size = path.stat().st_size
                        if not 0 < size <= MAX_BYTES:
                            raise ValueError('Track exceeds the 100 MB download limit.')
                        key = f"audio/imports/{uuid.uuid4().hex}.mp3"
                        s3.upload_file(str(path), bucket, key, ExtraArgs={'ContentType': 'audio/mpeg'})
                        stored_key = s3.stored_key(key) if isinstance(s3, AppStorage) else key
                        try:
                            track = rest('tracks', 'POST', body={
                                'title': entry['title'], 'artist': entry.get('artist') or None,
                                'album': entry.get('album') or None, 'duration': audio.get('duration'),
                                'file_key': stored_key, 'file_size': size, 'source_url': source,
                            })[0]
                        except Exception:
                            s3.delete_object(Bucket=bucket, Key=key)
                            raise
                        track_id = track['id']
                        reused = False
                if identity:
                    songs[identity] = track_id
                if track_id not in linked:
                    rest('playlist_tracks', 'POST', body={'playlist_id': personal['id'], 'track_id': track_id, 'position': position})
                    linked.add(track_id)
                job['reused' if reused else 'completed'] += 1
            except Exception as error:
                logging.exception('Import %s: track %s failed', job['id'], position)
                job['failed'] += 1
                job['errors'].append({'title': entry['title'], 'error': track_error(error)})
            save(job)
        job.update(status='complete', current_track='')
    except Exception as error:
        logging.exception('Import %s failed', job['id'])
        message = str(error) if isinstance(error, (ValueError, RuntimeError)) else track_error(error)
        job.update(status='failed', current_track='', error=message)
    finally:
        save(job)
