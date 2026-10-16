"""Foreground-only importer. No web server, startup task, or background service."""
import argparse
import logging
import os
from pathlib import Path
import shutil
import signal
import threading
import uuid

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent


def configure():
    load_dotenv(ROOT.parents[1] / '.env.local')
    load_dotenv(ROOT / '.env.local', override=True)
    os.environ['IMPORT_JOB_STORE'] = 'supabase'
    required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    if os.getenv('IMPORT_UPLOAD_API_URL'):
        required += ['MUSIC_IMPORT_WORKER_SECRET']
    else:
        required += ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
    missing = [name for name in required if not os.getenv(name)]
    missing += [name for name in ('node', 'ffmpeg', 'ffprobe') if not shutil.which(name)]
    if missing:
        raise RuntimeError('Missing settings or programs: ' + ', '.join(missing) + '. See MUSIC_IMPORT.md.')


def process_job(worker, job, claim):
    finished = threading.Event()
    worker.CLAIM = claim

    def heartbeat():
        while not finished.wait(20):
            try:
                renewed = worker.rest('rpc/renew_music_import', 'POST', body={
                    'p_id': job['id'], 'p_claim': claim,
                })
                if finished.is_set():
                    return
                if not renewed:
                    raise RuntimeError('Import claim expired.')
            except Exception:
                if finished.is_set():
                    return
                print('Lost contact with SAFI. Stopping this import; saved songs are kept.', flush=True)
                worker.STOP.set()
                return

    thread = threading.Thread(target=heartbeat, daemon=True)
    thread.start()
    try:
        worker.run(job)
    finally:
        finished.set()
        thread.join()
        worker.CLAIM = None


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--once', action='store_true', help='Import the current queue and exit when empty.')
    args = parser.parse_args(argv)
    configure()
    import worker

    def stop(*_):
        print('\nStopping the importer. Saved songs are kept. Please wait for this window to finish.', flush=True)
        worker.STOP.set()

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    print('SAFI PC importer is ON. Paste a playlist in SAFI > Add music.', flush=True)
    print('Press Ctrl+C to stop completely. Nothing starts automatically with Windows.', flush=True)
    claim = str(uuid.uuid4())
    try:
        while not worker.STOP.is_set():
            job = worker.rest('rpc/claim_music_import', 'POST', body={'p_claim': claim})
            if job:
                print('Starting playlist import...', flush=True)
                process_job(worker, job, claim)
            elif args.once:
                break
            else:
                worker.STOP.wait(5)
    except worker.ImportStopped:
        pass
    finally:
        worker.STOP.set()
        worker.POOL.shutdown(wait=True)
        print('SAFI PC importer is OFF.', flush=True)
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        logging.error('%s', error)
        raise SystemExit(1)
    except Exception:
        logging.error('Importer could not connect or finish. Check internet, .env.local settings, and the three SQL migrations.')
        raise SystemExit(1)
