-- Run once in the Supabase SQL Editor before starting the import worker.
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS source_url TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_source_url
  ON tracks (source_url) WHERE source_url IS NOT NULL;
