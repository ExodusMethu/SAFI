# Import playlists using your PC

Run imports only when you want them. There is no Windows service, scheduled
task, startup entry, public port, or tunnel. The importer runs in its visible
window and makes outbound requests to Supabase and storage. Playback uses
existing SAFI storage after the importer is switched off. Existing storage
and database allowances still apply.

## One-time setup

1. In your existing Supabase project's SQL editor, apply these files in order:
   - `migrations/20261014_music_import.sql`
   - `migrations/20261014_music_import_jobs.sql`
   - `migrations/20261016_local_music_import.sql`
2. Deploy the updated SAFI app. Set `MUSIC_IMPORT_MODE=local` on Vercel and
   redeploy. Keep your existing Supabase and R2 settings. No worker URL or
   worker secret is required for direct uploads from your PC. If you previously
   deployed a cloud importer, stop that service before switching to PC imports.
3. On your PC, install Python 3.12+, Node 22+, and FFmpeg/ffprobe on PATH.
   The repository root `.env.local` must contain `NEXT_PUBLIC_SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` from your existing projects.
   Never commit that file or share these credentials. Optional overrides go in
   `services/music-import/.env.local`; an example is provided in that folder.
4. Double-click **Start SAFI Importer.cmd**. The first launch creates a Python
   environment and installs dependencies. Later launches reuse it.

## Each time you want to import

Paste the playlist in **SAFI > Add music > Import playlist**, on your PC or
phone. Double-click **Start SAFI Importer.cmd** on your PC. Either order works:
requests wait in Supabase while the importer is off. Keep its window open
while importing; SAFI itself can be closed. Progress appears in both places.

Press **Ctrl+C** in the importer window to stop. Wait for **SAFI PC importer
is OFF**, then close the window. An in-progress upload may take up to its
two-minute network timeout to return. No importer process remains running.
Closing the window directly also terminates it; if a job was interrupted,
SAFI marks it stopped after its two-minute lease expires when progress is
checked or the importer starts again. Import the playlist again to finish;
saved songs are reused. An interrupted playlist may remain partially populated.

For a run that exits automatically when the queue is empty, use
`"Start SAFI Importer.cmd" --once` from Command Prompt. Without that option,
it waits for more requests until you stop it. It never starts with Windows.
Only one PC import runs at a time, even if you launch it twice.

Live imports require the app deployment, database migrations, and valid
credentials. Tests use mocks or an isolated database and do not deploy the
app or modify your live library. YouTube can reject individual downloads;
failed tracks are listed separately and successfully saved songs are kept.
