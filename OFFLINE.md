# Offline listening

SAFI stores downloaded audio and the library in IndexedDB. Its service worker
also stores the home page and every production JavaScript, CSS and other static
asset so the app can start without a connection.

## Build and deploy

Run `npm run build`, then `npm start` locally or deploy the resulting application.
The build command generates `public/offline-assets.js` from `.next/static` and
the Next.js build ID. Deploy that generated file together with `public/sw.js`
and the matching build. Configure hosting to use `npm run build`, not just
`next build`. `vercel.json` sets this command for Vercel deployments. The
generated manifest is intentionally ignored by Git.

The PWA plugin is no longer used: it could replace the custom worker and relies
on webpack, whereas this project builds with Turbopack. Offline registration is
enabled for production only; `npm run dev` is not an offline test environment.

## Check on a phone

1. Open the deployed HTTPS app while online. After an update, reopen it once
   while still online to use the newly installed worker and app version.
2. Allow the worker to finish downloading the app files. In browser developer
   tools, its status should be activated and the `safi-offline-<build ID>` cache
   should contain `/` and the `/_next/static/` files.
3. Download a song in SAFI. Use the same browser or installed home-screen app
   for downloading and playback; different browser contexts can have separate
   storage.
4. Close the app, enable airplane mode, reopen it and play the downloaded song.
   Try seeking and moving to the next downloaded song too.

A first-ever visit still requires internet. Sign-in, uploads and songs that have
not been downloaded require internet. Clearing site data also removes downloads
and the cached app. Phone browsers can reclaim site storage, so downloads are
not a permanent backup.

## Automated verification

`node --test scripts/test-offline-worker.cjs` checks first-install precaching,
network-free shell and chunk requests, failed updates, request exclusions and
cache cleanup using a simulated worker environment. A real phone test remains
necessary for browser storage and audio behavior.
