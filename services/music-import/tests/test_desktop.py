import os
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import desktop
import worker


class DesktopTests(unittest.TestCase):
    def tearDown(self):
        worker.STOP.clear()
        worker.CLAIM = None

    def test_environment_loaded_before_worker_and_forces_cloud_job_store(self):
        settings = dict.fromkeys(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
                                 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'], 'test')
        with patch.dict(os.environ, settings, clear=True), patch.object(desktop, 'load_dotenv'), \
                patch.object(desktop.shutil, 'which', return_value='installed'):
            desktop.configure()
            self.assertEqual(os.environ['IMPORT_JOB_STORE'], 'supabase')

    def test_once_exits_without_waiting_or_starting_a_server(self):
        with patch.object(desktop, 'configure'), patch.object(desktop.signal, 'signal'), \
                patch.object(worker, 'rest', return_value=None) as rest, patch.object(worker, 'POOL'):
            self.assertEqual(desktop.main(['--once']), 0)
        rest.assert_called_once()
        self.assertEqual(rest.call_args.args[0], 'rpc/claim_music_import')

    def test_stopped_download_kills_and_reaps_child_process(self):
        worker.STOP.set()
        process = Mock(pid=123)
        with patch.object(worker.subprocess, 'Popen', return_value=process), \
                patch.object(worker.subprocess, 'run') as kill, patch.object(worker.os, 'name', 'nt'):
            with self.assertRaises(worker.ImportStopped):
                worker.bridge('download', 'unused', '.', 600)
        self.assertEqual(kill.call_args.args[0], ['taskkill', '/PID', '123', '/T', '/F'])
        process.wait.assert_called_once_with()

    def test_stop_marks_job_failed_and_saves_it(self):
        job = {'id': 'test', 'url': 'https://music.youtube.com/playlist?list=PL1234567890'}
        with patch.object(worker, 'save') as save, \
                patch.object(worker, 'bridge', side_effect=worker.ImportStopped):
            with self.assertRaises(worker.ImportStopped):
                worker.run(job)
        self.assertEqual(job['status'], 'failed')
        self.assertIn('Saved songs were kept', job['error'])
        self.assertEqual(save.call_args.args[0]['status'], 'failed')

    def test_claimed_job_cannot_overwrite_expired_or_completed_job(self):
        worker.CLAIM = 'claim-token'
        with patch.object(worker, 'JOB_STORE', 'supabase'), patch.object(worker, 'rest', return_value=[]) as rest:
            with self.assertRaises(worker.ImportStopped):
                worker.save({'id': 'job', 'status': 'downloading'})
        self.assertEqual(rest.call_args.kwargs['params']['claimed_by'], 'eq.claim-token')
        self.assertEqual(rest.call_args.kwargs['params']['status'], 'in.(fetching,downloading)')

    def test_claim_is_cleared_when_import_aborts(self):
        with patch.object(worker, 'run', side_effect=worker.ImportStopped):
            with self.assertRaises(worker.ImportStopped):
                desktop.process_job(worker, {'id': 'test'}, 'claim')
        self.assertIsNone(worker.CLAIM)


if __name__ == '__main__':
    unittest.main()
