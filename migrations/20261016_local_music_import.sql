-- Apply after both 20261014 music-import migrations.
-- Desktop importers make outbound requests only; no public server is needed.
ALTER TABLE public.music_import_jobs ADD COLUMN IF NOT EXISTS claimed_by UUID;
ALTER TABLE public.music_import_jobs ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.expire_music_imports() RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE music_import_jobs
  SET status = 'failed', claimed_by = NULL, lease_until = NULL,
      state = state || jsonb_build_object('status', 'failed', 'current_track', '',
        'error', 'The PC importer stopped. Saved songs were kept. Import the playlist again to finish.')
  WHERE status IN ('fetching', 'downloading')
    AND (lease_until < now() OR (lease_until IS NULL AND claimed_by IS NULL));
$$;

CREATE OR REPLACE FUNCTION public.enqueue_music_import(p_user_id UUID, p_url TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE job JSONB; job_id TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(773164201);
  PERFORM expire_music_imports();
  IF EXISTS (SELECT 1 FROM music_import_jobs WHERE user_id = p_user_id
             AND status IN ('queued', 'fetching', 'downloading')) THEN
    RAISE EXCEPTION 'IMPORT_ALREADY_ACTIVE';
  END IF;
  IF (SELECT count(*) FROM music_import_jobs WHERE status IN ('queued', 'fetching', 'downloading')) >= 10 THEN
    RAISE EXCEPTION 'IMPORT_QUEUE_FULL';
  END IF;
  job_id := replace(gen_random_uuid()::text, '-', '');
  job := jsonb_build_object('id', job_id, 'user_id', p_user_id, 'url', p_url,
    'status', 'queued', 'title', '', 'total', 0, 'completed', 0, 'reused', 0,
    'failed', 0, 'current_track', '', 'errors', '[]'::jsonb, 'error', NULL, 'playlist_id', NULL);
  INSERT INTO music_import_jobs(id, user_id, status, state) VALUES(job_id, p_user_id, 'queued', job);
  RETURN job;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_music_import(p_claim UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE picked music_import_jobs%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(773164201);
  PERFORM expire_music_imports();
  -- One desktop import at a time, even if the launcher is opened twice.
  IF EXISTS (SELECT 1 FROM music_import_jobs WHERE claimed_by IS NOT NULL
             AND status IN ('fetching', 'downloading')) THEN RETURN NULL; END IF;
  SELECT * INTO picked FROM music_import_jobs WHERE status = 'queued'
    ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE music_import_jobs SET claimed_by = p_claim, lease_until = now() + interval '2 minutes',
    status = 'fetching', state = state || '{"status":"fetching"}'::jsonb
    WHERE id = picked.id RETURNING state INTO picked.state;
  RETURN picked.state;
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_music_import(p_id TEXT, p_claim UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE music_import_jobs SET lease_until = now() + interval '2 minutes'
    WHERE id = p_id AND claimed_by = p_claim AND lease_until > now()
      AND status IN ('fetching', 'downloading');
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_music_imports() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_music_import(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_music_import(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renew_music_import(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_music_imports() TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_music_import(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_music_import(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_music_import(TEXT, UUID) TO service_role;
