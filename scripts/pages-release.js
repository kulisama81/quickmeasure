/**
 * Production release helpers for Cloudflare Pages project quickmeasure.
 *
 *   node scripts/pages-release.js record
 *   node scripts/pages-release.js smoke
 *   node scripts/pages-release.js rollback
 *   node scripts/pages-release.js self-test
 *
 * record   — write the current successful production deployment id to
 *            GITHUB_OUTPUT (deployment_id) before a new upload.
 * smoke    — poll https://sourcedcalc.com until / and every sitemap URL
 *            return 200 and a nonexistent path returns 404.
 * rollback — POST the Pages deployments rollback API for
 *            PAGES_ROLLBACK_DEPLOYMENT_ID (the id captured by record).
 *
 * Uses CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Never prints them.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const https = require("https");
const path = require("path");

const PROJECT = "quickmeasure";
const SMOKE_ORIGIN = "https://sourcedcalc.com";
const PRODUCTION_HOSTS = {
  "sourcedcalc.com": true,
  "www.sourcedcalc.com": true,
  "quickmeasure-a3q.pages.dev": true,
};
const ROOT = path.join(__dirname, "..");

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(
      name +
        " is not set. Add the " +
        name +
        " repository Actions secret before this deploy can run."
    );
  }
  return String(value).trim();
}

function assertAccountId(id) {
  if (!/^[a-f0-9]{32}$/i.test(id)) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID must be the 32-character Cloudflare account id."
    );
  }
  return id;
}

function assertDeploymentId(id) {
  if (!id || !/^[A-Za-z0-9-]{8,80}$/.test(id)) {
    throw new Error("Deployment id is missing or not a Pages deployment id.");
  }
  return id;
}

function cacheBustToken() {
  const token =
    process.env.SMOKE_CACHE_BUST || process.env.GITHUB_SHA || String(Date.now());
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(token)) {
    throw new Error("Smoke cache-bust token must be a short URL-safe token.");
  }
  return token;
}

function intEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(name + " must be an integer from " + min + " to " + max);
  }
  return n;
}

function successfulProduction(deployment) {
  if (!deployment || deployment.environment !== "production") return false;
  if (deployment.is_skipped) return false;
  const stage = deployment.latest_stage;
  return !!(stage && stage.name === "deploy" && stage.status === "success");
}

function hostnameOf(value) {
  try {
    return new URL(value).hostname;
  } catch (err) {
    return "";
  }
}

function isProductionAlias(deployment) {
  const aliases = deployment.aliases || [];
  for (let i = 0; i < aliases.length; i++) {
    if (PRODUCTION_HOSTS[hostnameOf(aliases[i])]) return true;
  }
  return false;
}

function selectRollbackTarget(deployments) {
  const candidates = (deployments || []).filter(successfulProduction);
  const aliased = candidates.filter(isProductionAlias);
  const pool = aliased.length ? aliased : candidates;
  pool.sort(function (a, b) {
    return String(b.created_on || "").localeCompare(String(a.created_on || ""));
  });
  return pool[0] || null;
}

function deploymentsQuery(accountId, page) {
  return (
    "/client/v4/accounts/" +
    encodeURIComponent(accountId) +
    "/pages/projects/" +
    PROJECT +
    "/deployments?env=production&per_page=25&page=" +
    page
  );
}

function deploymentPath(accountId, deploymentId) {
  return (
    "/client/v4/accounts/" +
    encodeURIComponent(accountId) +
    "/pages/projects/" +
    PROJECT +
    "/deployments/" +
    encodeURIComponent(deploymentId)
  );
}

function rollbackPath(accountId, deploymentId) {
  return deploymentPath(accountId, deploymentId) + "/rollback";
}

function sitemapLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match;
  while ((match = re.exec(xml))) locs.push(match[1]);
  return locs;
}

function canonicalPageUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "sourcedcalc.com") {
    throw new Error("refusing smoke URL that is not https://sourcedcalc.com: " + value);
  }
  url.search = "";
  url.hash = "";
  return url.origin + url.pathname;
}

function pagesFromSitemap(xml) {
  const locs = sitemapLocs(xml);
  if (!locs.length) throw new Error("sitemap.xml has no <loc> URLs");
  const seen = Object.create(null);
  const pages = [];
  function add(raw) {
    const page = canonicalPageUrl(raw);
    if (seen[page]) return;
    seen[page] = true;
    pages.push(page);
  }
  add(SMOKE_ORIGIN + "/");
  locs.forEach(add);
  return pages;
}

function cacheBust(pageUrl, token) {
  const url = new URL(pageUrl);
  url.searchParams.set("smoke", token);
  return url.href;
}

function smokePlan(xml, token) {
  const pages = pagesFromSitemap(xml);
  return {
    ok: pages.map(function (page) {
      return cacheBust(page, token);
    }),
    missing: SMOKE_ORIGIN + "/no-such-page-" + token,
  };
}

function cfRequest(method, apiPath, token) {
  return new Promise(function (resolve, reject) {
    const req = https.request(
      {
        hostname: "api.cloudflare.com",
        path: apiPath,
        method: method,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          "User-Agent": "sourcedcalc-pages-release",
        },
      },
      function (res) {
        const chunks = [];
        res.on("data", function (chunk) {
          chunks.push(chunk);
        });
        res.on("end", function () {
          const text = Buffer.concat(chunks).toString("utf8");
          let json;
          try {
            json = JSON.parse(text);
          } catch (err) {
            reject(new Error(method + " Pages API " + res.statusCode));
            return;
          }
          if (!json.success) {
            const message =
              (json.errors && json.errors[0] && json.errors[0].message) ||
              "Pages API request failed";
            reject(new Error(method + " Pages API " + res.statusCode + ": " + message));
            return;
          }
          resolve(json);
        });
      }
    );
    req.on("error", function () {
      reject(new Error(method + " Pages API network error"));
    });
    req.end();
  });
}

async function listProductionDeployments(accountId, token) {
  const all = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= 5) {
    const json = await cfRequest("GET", deploymentsQuery(accountId, page), token);
    const batch = json.result || [];
    for (let i = 0; i < batch.length; i++) all.push(batch[i]);
    totalPages = (json.result_info && json.result_info.total_pages) || 1;
    page += 1;
  }
  return all;
}

function writeGithubOutput(name, value) {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error("bad output name");
  if (/[\r\n]/.test(String(value))) throw new Error("bad output value");
  const line = name + "=" + value + "\n";
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, line);
  }
  console.log(name + "=" + value);
}

async function record() {
  const accountId = assertAccountId(requireEnv("CLOUDFLARE_ACCOUNT_ID"));
  const token = requireEnv("CLOUDFLARE_API_TOKEN");
  const deployments = await listProductionDeployments(accountId, token);
  const target = selectRollbackTarget(deployments);
  if (!target) {
    throw new Error(
      "No successful production deployment on project " +
        PROJECT +
        ". Refusing to deploy without a rollback target."
    );
  }
  console.log(
    "Current production deployment " +
      target.id +
      " will be the rollback target if smoke fails."
  );
  writeGithubOutput("deployment_id", target.id);
}

async function runSmokeOnce(fetchImpl, token) {
  const sitemapUrl = cacheBust(SMOKE_ORIGIN + "/sitemap.xml", token);
  const sitemapRes = await fetchImpl(sitemapUrl);
  if (sitemapRes.status !== 200) {
    throw new Error("GET " + sitemapUrl + " returned " + sitemapRes.status);
  }
  const xml = await sitemapRes.text();
  const plan = smokePlan(xml, token);
  for (let i = 0; i < plan.ok.length; i++) {
    const url = plan.ok[i];
    const res = await fetchImpl(url);
    if (res.status !== 200) {
      throw new Error("GET " + url + " returned " + res.status + ", expected 200");
    }
  }
  const missing = await fetchImpl(plan.missing);
  if (missing.status !== 404) {
    throw new Error(
      "GET " + plan.missing + " returned " + missing.status + ", expected 404"
    );
  }
  console.log(
    "Smoke ok: " + plan.ok.length + " URL(s) returned 200 and " + plan.missing + " returned 404."
  );
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function pollSmoke(fetchImpl, options) {
  const attempts = options.attempts;
  const delayMs = options.delayMs;
  const wait = options.sleep || sleep;
  const report = options.report || function (line) {
    console.error(line);
  };
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      await runSmokeOnce(fetchImpl, options.token);
      console.log("Smoke check passed on attempt " + i + " of " + attempts + ".");
      return;
    } catch (err) {
      lastError = err;
      report("Smoke attempt " + i + " of " + attempts + " failed: " + err.message);
      if (i < attempts) await wait(delayMs);
    }
  }
  throw lastError;
}

function liveFetch(url) {
  return fetch(url, {
    redirect: "manual",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Accept: "*/*",
      "User-Agent": "sourcedcalc-pages-smoke",
    },
    signal: AbortSignal.timeout(20000),
  });
}

async function smoke() {
  const token = cacheBustToken();
  await pollSmoke(liveFetch, {
    token: token,
    attempts: intEnv("SMOKE_ATTEMPTS", 6, 1, 12),
    delayMs: intEnv("SMOKE_DELAY_MS", 10000, 0, 30000),
  });
}

async function rollback() {
  const accountId = assertAccountId(requireEnv("CLOUDFLARE_ACCOUNT_ID"));
  const token = requireEnv("CLOUDFLARE_API_TOKEN");
  const deploymentId = assertDeploymentId(process.env.PAGES_ROLLBACK_DEPLOYMENT_ID);
  const current = await cfRequest("GET", deploymentPath(accountId, deploymentId), token);
  if (!successfulProduction(current.result)) {
    throw new Error(
      "Refusing to roll back to " +
        deploymentId +
        " because it is not a successful production deployment."
    );
  }
  const rolled = await cfRequest("POST", rollbackPath(accountId, deploymentId), token);
  const restoredId = rolled.result && rolled.result.id;
  console.log(
    "Rolled production back to deployment " +
      deploymentId +
      (restoredId ? " (new deployment " + restoredId + ")." : ".") +
      " The job still fails."
  );
}

function workflowText(name) {
  return fs.readFileSync(path.join(ROOT, ".github/workflows", name), "utf8");
}

function assertPinned(yml, label) {
  const uses = yml.match(/uses:\s*\S+/g) || [];
  assert.ok(uses.length >= 2, label + " must pin its actions");
  uses.forEach(function (line) {
    assert.ok(
      /@([0-9a-f]{40})\b/.test(line),
      label + " action is not pinned to a SHA: " + line
    );
    assert.ok(!/@v\d/.test(line), label + " must not use a floating action tag: " + line);
  });
}

function stage(status, name) {
  return { name: name || "deploy", status: status };
}

function deployment(fields) {
  return Object.assign(
    {
      environment: "production",
      is_skipped: false,
      latest_stage: stage("success"),
      aliases: [],
      created_on: "2026-01-01T00:00:00.000Z",
    },
    fields
  );
}

function response(status, body) {
  return {
    status: status,
    text: function () {
      return Promise.resolve(body || "");
    },
  };
}

const SAMPLE_SITEMAP =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  "<urlset>" +
  "<loc>https://sourcedcalc.com/</loc>" +
  "<loc>https://sourcedcalc.com/paint-coverage/</loc>" +
  "</urlset>";

async function selfTest() {
  const older = deployment({
    id: "older-deploy",
    created_on: "2026-01-01T00:00:00.000Z",
  });
  const current = deployment({
    id: "current-deploy",
    created_on: "2026-02-01T00:00:00.000Z",
    aliases: [
      "https://sourcedcalc.com",
      "https://quickmeasure-a3q.pages.dev",
    ],
  });
  const preview = deployment({
    id: "preview-deploy",
    environment: "preview",
    created_on: "2026-03-01T00:00:00.000Z",
    aliases: ["https://abc.quickmeasure-a3q.pages.dev"],
  });
  const failed = deployment({
    id: "failed-deploy",
    created_on: "2026-04-01T00:00:00.000Z",
    latest_stage: stage("failure"),
    aliases: ["https://sourcedcalc.com"],
  });
  assert.strictEqual(
    selectRollbackTarget([older, preview, failed, current]).id,
    "current-deploy"
  );
  assert.strictEqual(selectRollbackTarget([older, preview, failed]).id, "older-deploy");
  assert.strictEqual(selectRollbackTarget([]), null);
  assert.strictEqual(
    selectRollbackTarget([
      deployment({
        id: "www-alias",
        aliases: ["https://www.sourcedcalc.com/"],
        created_on: "2026-05-01T00:00:00.000Z",
      }),
      older,
    ]).id,
    "www-alias"
  );

  const plan = smokePlan(SAMPLE_SITEMAP, "abc123");
  assert.deepStrictEqual(plan.ok, [
    "https://sourcedcalc.com/?smoke=abc123",
    "https://sourcedcalc.com/paint-coverage/?smoke=abc123",
  ]);
  assert.strictEqual(plan.missing, "https://sourcedcalc.com/no-such-page-abc123");
  assert.throws(function () {
    pagesFromSitemap("<urlset><loc>https://example.com/</loc></urlset>");
  }, /sourcedcalc\.com/);
  assert.throws(function () {
    pagesFromSitemap("<urlset></urlset>");
  }, /no <loc>/);

  const account = "a".repeat(32);
  assert.strictEqual(
    rollbackPath(account, "current-deploy"),
    "/client/v4/accounts/" +
      account +
      "/pages/projects/quickmeasure/deployments/current-deploy/rollback"
  );

  let sleeps = 0;
  let healthy = false;
  await pollSmoke(
    function (url) {
      if (!healthy) return Promise.resolve(response(503, ""));
      if (url.indexOf("/sitemap.xml") !== -1) return Promise.resolve(response(200, SAMPLE_SITEMAP));
      if (url.indexOf("/no-such-page-") !== -1) return Promise.resolve(response(404, "missing"));
      return Promise.resolve(response(200, "ok"));
    },
    {
      token: "abc123",
      attempts: 3,
      delayMs: 1,
      report: function () {},
      sleep: function () {
        sleeps += 1;
        healthy = true;
        return Promise.resolve();
      },
    }
  );
  assert.strictEqual(sleeps, 1);

  await assert.rejects(
    pollSmoke(
      function () {
        return Promise.resolve(response(500, ""));
      },
      {
        token: "abc123",
        attempts: 2,
        delayMs: 0,
        report: function () {},
        sleep: function () {
          return Promise.resolve();
        },
      }
    ),
    /503|500|sitemap/
  );

  await assert.rejects(
    runSmokeOnce(function (url) {
      if (url.indexOf("/sitemap.xml") !== -1) return Promise.resolve(response(200, SAMPLE_SITEMAP));
      if (url.indexOf("/no-such-page-") !== -1) return Promise.resolve(response(200, "oops"));
      return Promise.resolve(response(200, "ok"));
    }, "abc123"),
    /expected 404/
  );

  const prCi = workflowText("pr-ci.yml");
  const deploy = workflowText("pages-deploy.yml");
  assertPinned(prCi, "PR CI");
  assertPinned(deploy, "Pages deploy");
  assert.ok(/pull_request/.test(prCi), "PR CI must run on pull_request");
  assert.ok(/npm ci/.test(prCi) && /npm test/.test(prCi));
  assert.ok(/pages-release\.js self-test/.test(prCi));
  assert.ok(/cancel-in-progress:\s*false/.test(deploy), "deploys must not cancel each other");
  assert.ok(/concurrency:/.test(deploy));
  assert.ok(/npm ci/.test(deploy) && /npm test/.test(deploy));
  assert.ok(/npm run pages:deploy/.test(deploy));
  assert.ok(/--project-name=quickmeasure/.test(deploy));
  assert.ok(/--branch=main/.test(deploy));
  assert.ok(/--commit-hash=\$\{\{\s*github\.sha\s*\}\}/.test(deploy));
  assert.ok(/secrets\.CLOUDFLARE_API_TOKEN/.test(deploy));
  assert.ok(/secrets\.CLOUDFLARE_ACCOUNT_ID/.test(deploy));
  assert.ok(/pages-release\.js record/.test(deploy));
  assert.ok(/pages-release\.js smoke/.test(deploy));
  assert.ok(/pages-release\.js rollback/.test(deploy));
  assert.ok(/PAGES_ROLLBACK_DEPLOYMENT_ID/.test(deploy));
  assert.ok(
    deploy.indexOf("npm test") < deploy.indexOf("npm run pages:deploy"),
    "tests must run before wrangler"
  );
  assert.ok(
    deploy.indexOf("pages-release.js record") < deploy.indexOf("npm run pages:deploy"),
    "rollback target must be recorded before upload"
  );
  assert.ok(
    deploy.indexOf("npm run pages:deploy") < deploy.indexOf("pages-release.js smoke") &&
      deploy.indexOf("pages-release.js smoke") < deploy.indexOf("pages-release.js rollback")
  );
  assert.ok(!/ignore-scripts=false/.test(prCi + deploy));
  assert.ok(!/npx\s+(--yes\s+)?wrangler@/.test(prCi + deploy));
  assert.ok(!/enableAutoMerge|gh pr merge --auto/.test(prCi + deploy));
  assert.ok(
    fs.readFileSync(path.join(ROOT, ".npmrc"), "utf8").includes("ignore-scripts=true")
  );
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
  assert.strictEqual(lock.packages["node_modules/wrangler"].version, "4.126.0");

  console.log("pages-release self-test ok");
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "self-test") return selfTest();
  if (cmd === "record") return record();
  if (cmd === "smoke") return smoke();
  if (cmd === "rollback") return rollback();
  throw new Error(
    "usage: node scripts/pages-release.js <record|smoke|rollback|self-test>"
  );
}

if (require.main === module) {
  main().catch(function (err) {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = {
  selectRollbackTarget,
  smokePlan,
  pagesFromSitemap,
  rollbackPath,
  successfulProduction,
};
