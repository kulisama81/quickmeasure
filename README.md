# Quick Measure

Boring home calculators. Static HTML/CSS/JS. No SPA, no npm build, no ads.

## Pages

- `/` — home
- `/wa-heat-pump-rebate/` — Washington heat pump rebate calculator (2026). Official published amounts only.
- `/paint-coverage/` — interior room paint gallons
- `/concrete-bags/` — rectangular slab premix bags

## Run locally

Open the files in a browser:

```bash
# from this directory
open index.html
```

Or serve the folder (needed if a browser blocks `file://` scripts):

```bash
npx --yes serve .
```

Then open the URL it prints (usually `http://localhost:3000`).

There is no `npm install` and no build step.

## Cloudflare Pages

Connect the GitHub repo as a **Pages** project.

- **Build command:** leave empty (this is already the site)
- **Build output directory / root:** `/` (the repository root is the static root)

Pages will serve `index.html` at `/`, `wa-heat-pump-rebate/index.html` at `/wa-heat-pump-rebate/`, and so on.

### Wrangler

`wrangler.jsonc` points Workers static assets at this directory (`assets.directory: "."`).

```bash
npx wrangler deploy
# or
npx wrangler pages deploy .
```

Project name: `quickmeasure`. Compatibility date: `2026-08-01`.

## Custom domain later

In the Cloudflare dashboard: **Workers & Pages** → the `quickmeasure` Pages (or Workers) project → **Custom domains** → add your domain. Cloudflare will ask you to add a CNAME (or use their nameservers) so the domain points at the project. No code change is required.

## What this site will not do

- Invent rebate dollars
- Capture leads, show ads, or set a cookie wall
- Treat ZIP as your utility
- Budget a federal HARP/HOMES $8,000 figure for Washington in 2026
