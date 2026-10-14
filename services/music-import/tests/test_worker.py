import asyncio
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
import uuid
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import worker
from fastapi.testclient import TestClient

USER = str(uuid.uuid4())
OTHER = str(uuid.uuid4())
PLAYLIST = 'https://music.youtube.com/playlist?list=PL1234567890'
VIDEO = 'https://www.youtube.com/watch?v=abcdefghijk'
SETTINGS = {
    'MUSIC_IMPORT_WORKER_SECRET': 'test-secret',
    'NEXT_PUBLIC_SUPABASE_URL': 'https://test.supabase.co',
    'SUPABASE_SERVICE_ROLE_KEY': 'test-service-key',
    'R2_ACCOUNT_ID': 'test', 'R2_ACCESS_KEY_ID': 'test-key',
    'R2_SECRET_ACCESS_KEY': 'test-secret-key', 'R2_BUCKET_NAME': 'test-bucket',
}


class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.env = patch.dict(os.environ, SETTINGS)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.store = patch.object(worker, 'JOB_STORE', 'sqlite')
        self.store.start()
        self.addCleanup(self.store.stop)
        self.data = patch.object(worker, 'DATA', Path(self.folder.name))
        self.data.start()
        self.addCleanup(self.data.stop)
        self.pool = patch.object(worker, 'POOL', Mock())
        self.pool.start()
        self.addCleanup(self.pool.stop)
        self.client = TestClient(worker.app)
        self.headers = {'Authorization': 'Bearer test-secret'}

    def create(self, user=USER):
        response = self.client.post('/imports', json={'user_id': user, 'url': PLAYLIST}, headers=self.headers)
        self.assertEqual(response.status_code, 202, response.text)
        return response.json()

    def test_secret_required_and_job_ownership(self):
        self.assertEqual(self.client.post('/imports', json={'user_id': USER, 'url': PLAYLIST}).status_code, 401)
        job = self.create()
        response = self.client.get(f"/imports/{job['id']}?user_id={OTHER}", headers=self.headers)
        self.assertEqual(response.status_code, 404)
        self.assertIsNone(self.client.get(f'/imports?user_id={OTHER}', headers=self.headers).json())
        self.assertEqual(self.client.get(f'/imports?user_id={USER}', headers=self.headers).json()['id'], job['id'])

    def test_public_health_has_no_job_data(self):
        response = self.client.get('/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_app_storage_uses_signed_url_and_returned_key(self):
        path = Path(self.folder.name) / 'track.mp3'
        path.write_bytes(b'audio')
        signed = Mock(ok=True)
        signed.json.return_value = {'url': 'https://storage.test/signed', 'key': 'audio/imports/actual.mp3'}
        with patch.dict(os.environ, {'IMPORT_UPLOAD_API_URL': 'https://safi.test/api/music-import-upload'}), \
                patch.object(worker.requests, 'post', return_value=signed) as presign, \
                patch.object(worker.requests, 'put', return_value=Mock(ok=True)) as upload, \
                patch.object(worker.requests, 'delete', return_value=Mock(ok=True)) as cleanup:
            storage = worker.AppStorage()
            storage.upload_file(str(path), '', 'local-key')
            self.assertEqual(storage.stored_key('local-key'), 'audio/imports/actual.mp3')
            self.assertEqual(presign.call_args.kwargs['json'], {'size': 5})
            self.assertEqual(upload.call_args.args[0], 'https://storage.test/signed')
            self.assertNotIn('Authorization', upload.call_args.kwargs['headers'])
            storage.delete_object(Bucket='', Key='local-key')
            self.assertEqual(cleanup.call_args.kwargs['json'], {'key': 'audio/imports/actual.mp3'})

    def test_url_allowlist(self):
        for value in ['http://music.youtube.com/playlist?list=PL1234567890',
                      'https://youtube.com.evil.test/playlist?list=PL1234567890',
                      'https://localhost/playlist?list=PL1234567890',
                      'https://user:pass@youtube.com/playlist?list=PL1234567890',
                      'https://youtube.com:9999/playlist?list=PL1234567890',
                      'https://youtube.com/watch?v=abcdefghijk']:
            with self.subTest(value=value):
                result = self.client.post('/imports', json={'user_id': USER, 'url': value}, headers=self.headers)
                self.assertEqual(result.status_code, 400)
        self.assertEqual(worker.canonical_playlist(PLAYLIST + '&redirect=http://localhost'), PLAYLIST)

    def test_one_active_job_per_user(self):
        self.create()
        response = self.client.post('/imports', json={'user_id': USER, 'url': PLAYLIST}, headers=self.headers)
        self.assertEqual(response.status_code, 409)
        worker.POOL.submit.assert_called_once()

    def test_global_queue_limit(self):
        for _ in range(10):
            self.create(str(uuid.uuid4()))
        response = self.client.post('/imports', json={'user_id': USER, 'url': PLAYLIST}, headers=self.headers)
        self.assertEqual(response.status_code, 429)

    def test_exact_source_reuse_and_partial_failure(self):
        job = self.create()
        entries = [{'title': 'Existing', 'url': VIDEO},
                   {'title': 'Unavailable', 'url': 'https://evil.test/audio'}]
        writes = []

        def rest(table, method='GET', params=None, body=None):
            if table == 'tracks':
                return [{'id': 'existing'}] if params.get('source_url') else []
            if table == 'playlists':
                return [{'id': 'playlist'}]
            writes.append(body)
            return [body]

        with patch.object(worker, 'bridge', return_value={'title': 'Test', 'tracks': entries}) as bridge, \
                patch.object(worker, 'rest', side_effect=rest), patch.object(worker.boto3, 'client') as storage:
            worker.run(job)
        bridge.assert_called_once()
        storage.return_value.upload_file.assert_not_called()
        saved = worker.latest(USER)
        self.assertEqual((saved['status'], saved['reused'], saved['failed']), ('complete', 1, 1))
        self.assertEqual(writes[0]['track_id'], 'existing')
        self.assertEqual(saved['errors'][0]['title'], 'Unavailable')

    def test_manual_upload_duplicates_reused_without_download(self):
        job = self.create()
        entry = {'title': '  MY Song ', 'artist': 'ARTIST', 'url': VIDEO}

        def rest(table, method='GET', params=None, body=None):
            if table == 'tracks':
                return [{'id': 'manual', 'title': 'My Song', 'artist': 'Artist'}] if params.get('offset') else []
            return [{'id': 'playlist'}] if table == 'playlists' else [body]

        with patch.object(worker, 'bridge', return_value={'title': 'Test', 'tracks': [entry, entry]}) as bridge, \
                patch.object(worker, 'rest', side_effect=rest), patch.object(worker.boto3, 'client') as storage:
            worker.run(job)
        bridge.assert_called_once()
        storage.return_value.upload_file.assert_not_called()
        self.assertEqual(worker.latest(USER)['reused'], 2)
        self.assertEqual(worker.latest(USER)['failed'], 0)

    def test_upload_metadata_and_cleanup_after_database_failure(self):
        for fail_insert in (False, True):
            with self.subTest(fail_insert=fail_insert):
                job = self.create()
                track_body = []

                def bridge(action, value, directory, timeout):
                    if action == 'playlist':
                        return {'title': 'Test', 'tracks': [{'title': 'Song', 'artist': 'Artist', 'url': VIDEO}]}
                    self.assertEqual(value, VIDEO)
                    path = Path(directory) / 'track.mp3'
                    path.write_bytes(b'fake mp3')
                    return {'path': str(path), 'duration': 123}

                def rest(table, method='GET', params=None, body=None):
                    if method == 'GET': return []
                    if table == 'playlists': return [{'id': 'playlist'}]
                    if table == 'tracks':
                        track_body.append(body)
                        if fail_insert: raise RuntimeError('DB failed')
                        return [{'id': 'track'}]
                    return [body]

                with patch.object(worker, 'bridge', side_effect=bridge), \
                        patch.object(worker, 'rest', side_effect=rest), patch.object(worker.boto3, 'client') as storage:
                    worker.run(job)
                storage.return_value.upload_file.assert_called_once()
                self.assertEqual(storage.return_value.delete_object.call_count, int(fail_insert))
                self.assertEqual(track_body[0]['source_url'], VIDEO)
                self.assertEqual(track_body[0]['duration'], 123)
                self.assertEqual(worker.latest(USER)['completed'], int(not fail_insert))
                self.assertEqual(worker.latest(USER)['failed'], int(fail_insert))

    def test_restart_marks_incomplete_job_failed(self):
        job = self.create()

        async def restart():
            async with worker.lifespan(worker.app):
                pass

        asyncio.run(restart())
        saved = worker.latest(USER, job['id'])
        self.assertEqual(saved['status'], 'failed')
        self.assertIn('restarted', saved['error'])

    def test_oversized_playlist_rejected_before_writing(self):
        job = self.create()
        with patch.object(worker, 'bridge', return_value={
                'title': 'Large', 'tracks': [{}] * (worker.MAX_TRACKS + 1)}), patch.object(worker, 'rest') as rest:
            worker.run(job)
        rest.assert_not_called()
        self.assertEqual(worker.latest(USER)['status'], 'failed')

    def test_supabase_jobs_survive_local_filesystem_loss(self):
        rows = {}

        def rest(table, method='GET', params=None, body=None):
            self.assertEqual(table, 'music_import_jobs')
            if method == 'POST':
                rows[body['id']] = json.loads(json.dumps(body))
                return [body]
            if method == 'PATCH':
                rows[params['id'][3:]].update(json.loads(json.dumps(body)))
                return []
            result = list(rows.values())
            if params.get('user_id'):
                result = [row for row in result if row['user_id'] == params['user_id'][3:]]
            if params.get('id'):
                result = [row for row in result if row['id'] == params['id'][3:]]
            if params.get('status'):
                result = [row for row in result if row['status'] in worker.ACTIVE]
            return result

        with patch.object(worker, 'JOB_STORE', 'supabase'), patch.object(worker, 'rest', side_effect=rest), \
                patch.object(worker, 'db', side_effect=AssertionError('Free cloud host must not use SQLite')):
            job = self.create()
            self.assertEqual(worker.latest(USER)['id'], job['id'])
            self.assertIsNone(worker.latest(OTHER))
            job.update(status='downloading', completed=2)
            worker.save(job)
            self.assertEqual(worker.latest(USER)['completed'], 2)

            async def restart():
                async with worker.lifespan(worker.app):
                    pass

            asyncio.run(restart())
            saved = worker.latest(USER)
            self.assertEqual(saved['status'], 'failed')
            self.assertEqual(saved['completed'], 2)


if __name__ == '__main__':
    unittest.main()
