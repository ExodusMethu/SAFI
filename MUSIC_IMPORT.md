# YouTube Music playlist imports

SAFI runs on Vercel. The downloader runs on a separate **free Render web service**, so your PC can be switched off. R2 stores the MP3s; your existing Supabase project stores track metadata, playlists, and import progress.

In **Add music**, paste a public or unlisted YouTube Music playlist link and select **Import playlist**. The worker downloads each entry's exact video, converts it to MP3, and creates a playlist owned by the signed-in user. Tracks join SAFI's shared library. Private playlists and Google account linking are not included.

## Prepared in this repository

- `render.yaml`: Free Docker web service, 100 tracks per import, no paid disk, manual deployments.
- `services/music-import/Dockerfile`: Python, FFmpeg, and Node; one worker process.
- `migrations/20261014_music_import.sql`: Source-link deduplication.
- `migrations/20261014_music_import_jobs.sql`: Persistent progress in Supabase.
- `vercel.json`: Next.js, `npm ci`, and the existing build/offline-assets command.
- `.env.example`: Required Vercel variables without credentials.

These files prepare deployment. They do not create accounts, apply SQL, set cloud variables, or deploy a live service by themselves.

## One-time cloud setup

1. Apply both migration files in the **existing SAFI Supabase project**, in the order listed above. The jobs table is restricted to the service-role backend.
2. Publish the integration to the GitHub branch used for deployment.
3. Create a free Render account and connect the SAFI repository. Create a Blueprint using root `render.yaml`. Confirm the compute plan is **Free**, with no paid disk or resources. If a payment or paid upgrade is required, stop.
4. Set the Render variables below using the existing Supabase and R2 credentials. Build and deploy. Check the assigned HTTPS URL's `/health` endpoint returns `{"status":"ok"}`.
5. Add the worker URL and matching secret to the existing SAFI Vercel project's **Production** environment. Redeploy the app.
6. Sign in and test a small accessible playlist. Confirm the tracks appear in the library and your personal imported playlist.

Cloud access is required before these live steps can be completed. Connect Supabase, Render, and Vercel to allow configuration through their tools. Render also needs access to the GitHub repository if it is private.

## Render variables

Set `MUSIC_IMPORT_WORKER_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `IMPORT_UPLOAD_API_URL=https://<your-safi-domain>/api/music-import-upload`. The deployed worker gets temporary R2 upload URLs from SAFI, so the existing R2 credentials remain only in Vercel. Direct R2 credentials on the worker remain an optional alternative for local/self-hosted use.

The Blueprint sets `IMPORT_JOB_STORE=supabase`, `IMPORT_MAX_TRACKS=100`, and `PORT=8000`. Run one instance and one process.

A shared secret has been prepared locally in the ignored `.qa/cloud-setup/worker-secret.env`. Its value is not committed or printed in chat. Use the same value on Render and Vercel.

## Vercel project

Use the existing SAFI project and GitHub repository `ExodusMethu/SAFI`. Preserve its existing production branch. Framework: **Next.js**. Root: repository root. Install: `npm ci`. Build: `npm run build`. Keep the existing Supabase and R2 variables listed in `.env.example`.

Add these as server-side Production variables:

```dotenv
MUSIC_IMPORT_WORKER_URL=https://<actual-assigned-service>.onrender.com
MUSIC_IMPORT_WORKER_SECRET=<the-same-secret-set-on-Render>
```

Mark the secret as sensitive. Never use a `NEXT_PUBLIC_` prefix or put it in `next.config.js`'s `env` setting, which exposes values to the client bundle. The browser calls SAFI's authenticated `/api/music-imports` gateway, which verifies the Supabase session and supplies the user ID.

Redeploy after changing variables. For previews, use a separate worker/database or leave imports unconfigured to avoid writes to the live library. Local `.env.local` setup is optional; the deployed app does not need a service on your PC.

## Free-plan limits

See [Render's free-service documentation](https://render.com/docs/free).

- The worker sleeps after 15 minutes without inbound requests; waking it can take about a minute. SAFI may temporarily report it unavailable while it wakes.
- Keep Add music open during an import. Its progress requests reach the worker. Leaving the screen can allow a long import to be interrupted when the worker sleeps.
- Free services can restart at any time. MP3s remain in R2 and progress remains in Supabase. Unfinished jobs are marked failed on startup; import again to reuse saved songs and try the rest.
- Free workspaces have 750 instance hours per month, plus separate bandwidth/build allowances. Heavy outbound transfers can cause suspension. This is suitable for small, occasional imports, not unlimited downloading.
- Do not add a payment method or enable paid usage. Without a payment method, Render suspends applicable usage at its allowance limits. Existing Supabase and R2 account-level allowances still apply.

YouTube can reject downloads from cloud IPs. A real playlist test after deployment is required to establish whether this host works. The integration does not bypass sign-in or access restrictions.

## Import behavior

One active import per user, at most ten queued/running imports, processed serially. The free Blueprint allows 100 playlist entries per import. Each track is limited to 30 minutes, 100 MB, and ten minutes of downloading.

Exact source URLs deduplicate repeated imports. Matching title and artist metadata, ignoring case and extra whitespace, also reuses manual uploads. Entries without artist metadata are not matched by title alone. Existing library tracks are kept; duplicates are skipped during import. Each import creates a new personal playlist. Failed entries are listed separately; successful tracks remain available. Playback and offline downloads use SAFI's existing features; artwork uses fallback covers.

The worker calls `mp3dl-main/mp3dl-main/mp3dl.py` and `playlist_fetcher.py`. The legacy MP3DL web server is not needed.

## Optional local testing

Install Python 3.12+, FFmpeg/ffprobe, and Node 20+ on PATH. Load the worker variables from `services/music-import/.env.example` into the shell, then:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r services/music-import/requirements.txt
.venv/Scripts/python.exe -m uvicorn worker:app --app-dir services/music-import --host 127.0.0.1 --port 8000 --workers 1
```

Only for local testing, use `MUSIC_IMPORT_WORKER_URL=http://127.0.0.1:8000` in `.env.local`. `IMPORT_JOB_STORE=sqlite` stores local jobs; `supabase` uses the jobs migration.

## Verification

```powershell
python -m pip install -r services/music-import/requirements-dev.txt
python -m unittest discover -s services/music-import/tests -v
npm run build
```

Tests mock extraction, storage, and database requests. They do not download songs or change a live library. Real imports require the migrations, credentials, deployed worker, and accessible playlist.
