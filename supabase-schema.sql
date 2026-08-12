-- Run this in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)

-- Tracks table (shared library — all users see all tracks)
CREATE TABLE IF NOT EXISTS tracks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  artist      TEXT,
  album       TEXT,
  duration    INTEGER,          -- seconds
  file_key    TEXT NOT NULL,    -- Cloudflare R2 object key
  cover_key   TEXT,             -- R2 key for album art
  file_size   BIGINT,           -- bytes
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Playlists (per-user)
CREATE TABLE IF NOT EXISTS playlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Playlist track associations
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position    INTEGER DEFAULT 0,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(playlist_id, track_id)
);

-- Index for faster playlist lookups
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_tracks_created ON tracks(created_at DESC);

-- Row Level Security: tracks are public read (shared library)
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read tracks" ON tracks FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert tracks" ON tracks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can delete tracks" ON tracks FOR DELETE USING (auth.role() = 'authenticated');

-- Playlists: users can only see/modify their own
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own playlists" ON playlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own playlists" ON playlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own playlists" ON playlists FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users update own playlists" ON playlists FOR UPDATE USING (auth.uid() = user_id);

-- Playlist tracks: viewable if you own the playlist
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own playlist tracks" ON playlist_tracks 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM playlists WHERE id = playlist_id AND user_id = auth.uid())
  );
