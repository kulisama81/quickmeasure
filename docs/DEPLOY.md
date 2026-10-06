# Deploying Sourced Calc

Production is Cloudflare Pages project `quickmeasure`, **Direct Upload**. sourcedcalc.com is the apex. `www.sourcedcalc.com` and `quickmeasure-a3q.pages.dev` 301 to the apex. There is no site build. `wrangler pages deploy` uploads this repo and compiles `_worker.js`.

Leave the Pages project disconnected from Git. This workflow is the only automatic deployer.

## What runs when

**Pull requests** (`.github/workflows/pr-ci.yml`)

- On every `pull_request`.
- `npm ci`, then `npm test` (`node scripts/check.js`), then `node scripts/pages-release.js self-test`.
- Any failed step fails the **check.js** job. Mark that job required in branch protection.
- Nothing auto-merges. A person merges.

**Push to `main`** (`.github/workflows/pages-deploy.yml`)

1. `npm ci`, then the same tests. A test failure stops the job before any upload.
2. Lists production deployments and saves the current successful production deployment id.
3. `npm run pages:deploy -- --project-name=quickmeasure --branch=main --commit-hash=<sha>` (wrangler **4.126.0** from `package-lock.json`).
4. Smoke-checks `https://sourcedcalc.com` with a `?smoke=<sha>` query. Polls up to 6 times, 10 seconds apart. `/` and every `<loc>` in `/sitemap.xml` must return 200. `/no-such-page-<sha>` must return 404.
5. If that smoke check fails, the job POSTs the Pages rollback API for the deployment id from step 2, then the job fails. A passing smoke check leaves the new deployment in production.

`concurrency` group `pages-deploy` queues overlapping merges (`cancel-in-progress: false`), so two uploads never run at once.

`npm ci` reads `.npmrc` (`ignore-scripts=true`). The workflows do not pass `--ignore-scripts=false` and do not call `npx wrangler@…`.

## Secrets

Add both under **Settings → Secrets and variables → Actions**. Do not commit them.

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token. Minimum permissions: **Account → Cloudflare Pages → Edit** and **Account → Account Settings → Read**. |
| `CLOUDFLARE_ACCOUNT_ID` | The account id from the dashboard (32 hex characters). It is not a token. |

Pages Edit is what lists deployments, uploads, and rolls back. Account Settings Read is what Wrangler uses to confirm the account. No zone DNS permission is required for this workflow.

## Roll back by hand

Dashboard: **Workers & Pages → quickmeasure → Deployments →** the earlier successful production deployment **→ Rollback**.

API (deployment id is the earlier production deployment to restore):

```bash
curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/quickmeasure/deployments?env=production"

curl -sS -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/quickmeasure/deployments/$DEPLOYMENT_ID/rollback"
```

Only a successful production deployment can be the rollback target.

## Turn auto-deploy off

**Actions → Pages deploy → ⋯ → Disable workflow.** Merges to `main` then do nothing to production. PR CI keeps running. Enable the same workflow to turn deploys back on.
