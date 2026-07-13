# Nebulous Fleet Viewer — with link sharing

## What this is
- `public/index.html` — the fleet viewer (same tool as before), now with
  a "Share Link" button in addition to "Share as Image".
- `netlify/functions/upload.mjs` — stores an uploaded `.fleet` file's raw
  XML in Netlify Blobs under a random ID, returns that ID.
- `netlify/functions/get.mjs` — looks up a fleet by ID and returns the raw
  XML.
- `netlify.toml` — tells Netlify where the site and functions live.

**Important:** these are written as Netlify Functions **v2** (ES module,
`export default`, Web `Request`/`Response`). v2 is supposed to get the
Blobs environment auto-configured with zero setup — v1 functions
(`exports.handler`, the older Lambda-compatible style) definitely don't.
In practice, auto-config has been unreliable on some deploys even with
v2, so both functions also support an explicit fallback: if you set
`BLOBS_SITE_ID` and `BLOBS_TOKEN` environment variables (see step 4
below), they'll be used instead of relying on auto-injection. If you
ever add more functions here, keep them in v2 style.

## How sharing works
1. Someone loads a `.fleet` file in the viewer and clicks **Share Link**.
2. The browser POSTs the raw file text to `/.netlify/functions/upload`.
3. The function saves it to Netlify Blobs and returns a short ID.
4. The viewer builds a link like `https://yoursite.netlify.app/?id=AbC123xy`.
5. Anyone who opens that link: the page reads `?id=` from the URL, calls
   `/.netlify/functions/get?id=...`, and renders the fleet — no local file
   needed on their end.

## Deploying
1. Push this folder to a GitHub repo (or drag-and-drop deploy on
   Netlify — but note drag-and-drop deploys don't install npm
   dependencies, so a Git-connected site is the more reliable option
   since it needs to install `@netlify/blobs`).
2. On Netlify: **Add new site → Import from Git**, point it at the repo.
   Build settings are already defined in `netlify.toml`
   (publish = `public`, functions = `netlify/functions`), so the
   defaults Netlify detects should just work.
3. Try it first without any extra setup — Netlify Blobs is *supposed* to
   need zero configuration. If **Share Link** works, you're done.
4. If you see an error like *"The environment has not been configured to
   use Netlify Blobs... supply siteID, token"*, set up the explicit
   fallback:
   1. Get your Site ID: Netlify dashboard → your site → **Site
      configuration → General → Site details** → copy the **Site ID**.
   2. Create a Personal Access Token: click your avatar (top right) →
      **User settings → Applications → Personal access tokens → New
      access token**. Give it any name, copy the token (you only see it
      once).
   3. In your site: **Site configuration → Environment variables → Add a
      variable**, add both:
      - `BLOBS_SITE_ID` = the Site ID from step 1
      - `BLOBS_TOKEN` = the token from step 2
   4. Redeploy (env var changes need a new deploy to take effect), then
      try **Share Link** again.
5. Test by uploading a `.fleet` file and clicking **Share Link**.

## Notes / things you may want to add later
- **No expiration yet** — shared fleets are stored indefinitely. If you
  want old links to expire, the simplest approach is storing a
  `createdAt` timestamp (already saved in blob metadata) and adding a
  scheduled function that deletes anything older than N days.
- **No rate limiting** — anyone can call `/upload` repeatedly. For a
  small personal/community tool this is usually fine; if it gets
  abused, Netlify's Firewall Traffic Rules (available on the Free plan)
  can throttle by IP.
- **IDs are public and unguessable-ish** (9 random alphanumeric chars),
  but not access-controlled — anyone with the link can view. There's no
  delete/unshare feature currently.
