# Sourced Calc

Boring home calculators. Static HTML/CSS/JS. No SPA, no npm build, no ads.

Public host: [https://sourcedcalc.com](https://sourcedcalc.com). The Cloudflare Pages project name is still `quickmeasure`. Production `https://quickmeasure-a3q.pages.dev` 301s to the apex (same path and query).

## Pages

- `/` — home
- `/wa-heat-pump-rebate/` — Washington heat pump rebate calculator (2026). Official published amounts only.
- `/paint-coverage/` — interior room paint gallons (coverage from official Sherwin-Williams pages)
- `/concrete-bags/` — rectangular slab premix bags (yields from official Quikrete / Sakrete pages)
- `/mortgage-limit/` — 2026 county mortgage cap (FHFA all-counties file; 1–4 unit limits as published)
- `/retirement-limits/` — 2026 401(k) / IRA yearly contribution caps (IRS newsroom + Notice 2025-67)
- `/mileage/` — 2026 IRS standard mileage rates (IRS table + Notice 2026-10 + mid-year revision)

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

Connect the GitHub repo as a **Pages** project named `quickmeasure`.

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

Project name: `quickmeasure`. Compatibility date: `2026-08-01`. Public host: `sourcedcalc.com`.

### Custom domain

Apex + www are attached to the existing Pages project (not a new project, not a newly purchased domain).

Wrangler 4.x has **no** `pages domain` command. Add the hostnames with the Pages domains API (same as **Workers & Pages → quickmeasure → Custom domains**):

```bash
# requires CLOUDFLARE_API_TOKEN with Pages Edit + Zone DNS Edit
node scripts/attach-custom-domain.js
```

That script:

1. `POST /accounts/{account_id}/pages/projects/quickmeasure/domains` for `sourcedcalc.com` and `www.sourcedcalc.com`
2. Creates proxied CNAME records to `quickmeasure-a3q.pages.dev` if they are missing (apex uses Cloudflare CNAME flattening)

Canonicals, `sitemap.xml`, and `robots.txt` hardcode `https://sourcedcalc.com`. This repo has no HTML build, so a `SITE_URL` env var would not rewrite those files.

`functions/_middleware.js` 301s `www.sourcedcalc.com` and production `quickmeasure-a3q.pages.dev` → `https://sourcedcalc.com` + same path and query. Preview hosts stay untouched. Pages `_redirects` cannot match on hostname, so a path rule would also fire on the custom domain.

## What this site will not do

- Invent rebate dollars, paint coverage, bag yields, mortgage caps, retirement contribution caps, or mileage cents not on the cited official pages
- Capture leads, show ads, or set a cookie wall
- Treat ZIP as your utility
- Budget a federal HARP/HOMES $8,000 figure for Washington in 2026
