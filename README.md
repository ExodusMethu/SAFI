# SAFI

SAFI is a music library and player with playlists and offline listening. The
web app runs on Next.js, Supabase stores its library data, and Cloudflare R2
stores the audio files.

## Import a YouTube Music playlist using your PC

The PC importer downloads playlist tracks and uploads them to SAFI. You run
it only when you want to import music. It has no startup entry, scheduled
task, background service, public port, or tunnel. After the music is uploaded,
your PC can be switched off and you can continue listening in SAFI.

You can submit a playlist from your phone. Requests wait in SAFI until an
importer is running. The PC running the importer needs internet access;
existing Supabase and R2 allowances still apply.

### Set up a PC once

Use a trusted PC administered by the app owner: the importer needs backend
credentials. Ordinary listeners do not need these credentials or the importer.

1. Download this repository from GitHub, or clone it:

   ```sh
   git clone https://github.com/ExodusMethu/SAFI.git
   cd SAFI
   ```

   Keep the complete folder, including `services` and `mp3dl-main`. If you
   download a ZIP, extract it before running the launcher.

2. Install these programs and make them available on PATH:

   - [Python 3.12 or newer](https://www.python.org/downloads/). On Windows,
     enable **Add Python to PATH** during installation.
   - [Node.js 22 or newer](https://nodejs.org/en/download/).
   - [FFmpeg](https://ffmpeg.org/download.html), including both `ffmpeg` and
     `ffprobe`. Add the directory containing those executables to PATH.

   Node is used by the downloader's JavaScript challenge solver; its minimum
   version follows [yt-dlp's Node runtime requirements](https://github.com/yt-dlp/yt-dlp/wiki/EJS#node).
   Close and reopen your terminal after installing programs or changing PATH.
   Check the installation in a terminal:

   ```sh
   python --version
   node --version
   ffmpeg -version
   ffprobe -version
   ```

   On macOS or Linux, use `python3` instead of `python` if necessary.

3. Copy `services/music-import/.env.local.example` to
   `services/music-import/.env.local` and fill in the existing SAFI project's
   settings:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   R2_ACCOUNT_ID=your-cloudflare-account-id
   R2_ACCESS_KEY_ID=your-r2-access-key
   R2_SECRET_ACCESS_KEY=your-r2-secret-key
   R2_BUCKET_NAME=safi-audio
   IMPORT_MAX_TRACKS=200
   ```

   Get the Supabase settings from the existing project's API settings and the
   R2 settings from its Cloudflare storage configuration. Use the same bucket
   as the deployed SAFI app. On a new PC you must supply these values again;
   they are deliberately excluded from GitHub. Keep the filename exactly
   `.env.local`, without a `.txt` suffix. Do not put these secrets in the README,
   browser code, or a commit.

   If your repository root `.env.local` already has these settings, that file
   works too. The importer loads it first; the file in `services/music-import`
   overrides it. You do not need to install the Next.js app dependencies just
   to run the importer.

### Run on Windows

1. Double-click **Start SAFI Importer.cmd** in the repository folder.
   The first run creates `.venv` and installs Python dependencies. Subsequent
   launches reuse that environment.
2. Leave the window open. In SAFI, sign in and open **Add music**. Paste a
   public or unlisted YouTube Music playlist link and select **Import playlist**.
   You can submit the playlist before launching the importer too.
3. Watch progress in SAFI or the importer window. You can close SAFI while the
   PC importer works and return later.
4. To stop completely, press **Ctrl+C** in the importer window. Wait for
   **SAFI PC importer is OFF**, then close the window. An upload already in
   progress may need time to finish or reach its network timeout.

For a run that finishes the current queue and exits automatically, open Command
Prompt in the SAFI folder and run:

```bat
"Start SAFI Importer.cmd" --once
```

In PowerShell, use `& ".\Start SAFI Importer.cmd" --once`. The batch launcher
pauses after the importer exits so you can read its output; the importer itself
is already off. Without `--once`, the importer waits for new requests until you
stop it. Nothing starts with Windows.

### Run on macOS or Linux

After installing the programs and configuring credentials above, run these
commands from the repository folder:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r services/music-import/requirements.txt
.venv/bin/python -u services/music-import/desktop.py
```

The first two commands are setup steps. For subsequent imports, run only the
last command. Add `--once` to process the current queue and exit when empty.
Press **Ctrl+C** to stop. The Windows `.cmd` launcher is not used on these
systems; the Python entry point supports them, but was tested on Windows.

### Switching PCs, updates, and interrupted imports

- Configure any replacement PC using the setup above. Only one PC import runs
  at a time; opening another importer does not process the same job twice.
- To update a Git clone, stop the importer and run `git pull --ff-only` in its
  folder. The Windows launcher installs changed Python requirements next time.
  On macOS/Linux, rerun the pip command after updating.
- You can close the importer window or shut down the PC. A job interrupted
  without graceful shutdown is marked stopped after its two-minute lease
  expires when progress is checked or an importer starts again. Submit the
  playlist again to finish; successfully saved tracks are reused. A partially
  filled playlist may remain from the interrupted attempt.
- If SAFI says the job is waiting, open the importer on the configured PC.
  If it reports a connection or configuration error, check internet access,
  credentials, and the database setup below.
- If downloads stop working after a YouTube change, stop the importer and run
  `.venv\Scripts\python.exe -m pip install --upgrade "yt-dlp[default]"` on
  Windows, or `.venv/bin/python -m pip install --upgrade 'yt-dlp[default]'` on
  macOS/Linux, then try again. Private or inaccessible tracks may still fail.

## App administrator: enable PC imports once

This is app setup, not something to repeat on each importer PC.

1. Apply these SQL files to the existing Supabase project, in order:
   `migrations/20261014_music_import.sql`,
   `migrations/20261014_music_import_jobs.sql`, and
   `migrations/20261016_local_music_import.sql`.
2. Deploy this repository to the existing Vercel project. Set its server-side
   `MUSIC_IMPORT_MODE=local` and redeploy. Keep the existing Supabase and R2
   environment settings from `.env.example`. Neither a worker URL nor worker
   secret is needed when the PC uploads directly to R2.
3. If a cloud importer was previously deployed, stop it before enabling PC
   imports. No hosted worker is needed for this mode.

For more detail, see [PC_IMPORT.md](PC_IMPORT.md). The optional hosted-worker
setup is documented in [MUSIC_IMPORT.md](MUSIC_IMPORT.md).

## Run the web app locally

Copy `.env.example` to `.env.local` and fill in the existing project's settings.
Then run:

```sh
npm ci
npm run dev
```

Open the address printed by Next.js. `npm run build` builds the production app
and its offline assets; `npm start` runs that build.

## Verification

```sh
node --test scripts/music-import-queue.test.mjs
```

For the Python tests on Windows:

```powershell
.venv\Scripts\python.exe -m pip install -r services/music-import/requirements-dev.txt
.venv\Scripts\python.exe -m unittest discover -s services/music-import/tests -v
```

On macOS/Linux, substitute `.venv/bin/python`. These tests mock downloads,
storage, and database requests; they do not import music into the live library.
