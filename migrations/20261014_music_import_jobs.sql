-- Persistent import progress for hosts with an ephemeral filesystem.
CREATE TABLE IF NOT EXISTS public.music_import_jobs (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'fetching', 'downloading', 'complete', 'failed')),
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_music_import_jobs_owner
  ON public.music_import_jobs (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_music_import_jobs_one_active
  ON public.music_import_jobs (user_id)
  WHERE status IN ('queued', 'fetching', 'downloading');
ALTER TABLE public.music_import_jobs ENABLE ROW LEVEL SECURITY;
-- Only the service-role backend can read or write job state.
REVOKE ALL ON public.music_import_jobs FROM anon, authenticated;
GRANT ALL ON public.music_import_jobs TO service_role;
