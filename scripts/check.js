const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const wa = require(path.join(root, "wa-heat-pump-rebate/calculator.js"));
const paint = require(path.join(root, "paint-coverage/calculator.js"));
const concrete = require(path.join(root, "concrete-bags/calculator.js"));
const loan = require(path.join(root, "mortgage-limit/calculator.js"));
const loanCsv = require(path.join(root, "scripts/loan-limit-csv.js"));
const retirement = require(path.join(root, "retirement-limits/calculator.js"));
const mileage = require(path.join(root, "mileage/calculator.js"));
const hsa = require(path.join(root, "hsa-limits/calculator.js"));
const std = require(path.join(root, "standard-deduction/calculator.js"));
const tax = require(path.join(root, "tax-brackets/calculator.js"));
const fsa = require(path.join(root, "fsa-limits/calculator.js"));

function hasDollar(text, n) {
  return String(text).indexOf("$" + n.toLocaleString("en-US")) !== -1 ||
    String(text).indexOf("$" + n) !== -1;
}

// Paint: default coverage is within SuperPaint PDS 350–400
assert.strictEqual(paint.DEFAULT_COVERAGE, 350);
assert.ok(paint.DEFAULT_COVERAGE >= 350 && paint.DEFAULT_COVERAGE <= 400);

// Paint: 12×10×8, 1 door, 1 window, 2 coats, 350 sq ft/gal
const p = paint.calc({
  length: 12,
  width: 10,
  height: 8,
  doors: 1,
  windows: 1,
  coats: 2,
  coverage: 350,
});
assert.strictEqual(p.gross, 352);
assert.strictEqual(p.openings, 35);
assert.strictEqual(p.net, 317);
assert.ok(Math.abs(p.raw - 317 * 2 / 350) < 1e-9);
assert.strictEqual(p.buy, 2);

const pDefault = paint.calc({
  length: 12,
  width: 10,
  height: 8,
  doors: 1,
  windows: 1,
  coats: 2,
});
assert.strictEqual(pDefault.coverage, 350);
assert.strictEqual(pDefault.buy, p.buy);

// Concrete: 10×10×4 in, 80 lb
const c = concrete.calc({ length: 10, width: 10, thickness: 4, bag: "80" });
assert.ok(Math.abs(c.cuFt - 100 * (4 / 12)) < 1e-9);
assert.strictEqual(c.perBag, 0.6);
assert.strictEqual(c.buy, 56);

const c40 = concrete.calc({ length: 10, width: 10, thickness: 4, bag: "40" });
assert.strictEqual(c40.perBag, 0.3);
assert.strictEqual(c40.buy, 112);

// WA: never assign utility from ZIP
const z = wa.estimate({
  zip: "98118",
  utility: "unknown",
  heat: "oil",
  income: "under150",
});
assert.strictEqual(z.pill, "unknown");
assert.ok(/not used to pick/i.test(z.zipWarning) || /do not assign/i.test(z.zipWarning) || /not used/i.test(z.headline + z.bullets.join(" ")));
assert.ok(!/you are a PSE/i.test(z.headline));

const outZip = wa.estimate({
  zip: "10001",
  utility: "pse",
  heat: "oil",
  income: "over150",
});
assert.ok(/does not look like Washington/i.test(outZip.zipWarning));

// PSE electric resistance
const pseEl = wa.estimate({
  zip: "",
  utility: "pse",
  heat: "electric-furnace",
  income: "over150",
});
assert.strictEqual(pseEl.pill, "public");
assert.ok(hasDollar(pseEl.headline, 1500) || hasDollar(pseEl.headline, "1,500"));
assert.ok(pseEl.bullets.some((b) => /Trade Ally/i.test(b)));

const pseBoost = wa.estimate({
  zip: "",
  utility: "pse",
  heat: "zonal",
  income: "under150",
});
assert.strictEqual(pseBoost.pill, "range");
assert.ok(pseBoost.headline.indexOf("2,400") !== -1);

const pseHp = wa.estimate({
  zip: "",
  utility: "pse",
  heat: "heat-pump",
  income: "unknown",
});
assert.ok(/centrally ducted/i.test(pseHp.headline + pseHp.bullets.join(" ")));

const pseOil = wa.estimate({
  zip: "",
  utility: "pse",
  heat: "oil",
  income: "under150",
});
assert.strictEqual(pseOil.pill, "unknown");
assert.ok(/no published/i.test(pseOil.headline));
assert.ok(!pseOil.bullets.some((b) => /oil-to-heat-pump rebate: \$/.test(b)));

const pseGas = wa.estimate({
  zip: "",
  utility: "pse",
  heat: "gas",
  income: "under150",
});
assert.ok(pseGas.headline.indexOf("4,000") !== -1);
assert.ok(/do not (add|stack)/i.test(pseGas.headline + pseGas.bullets.join(" ")));
assert.ok(/not automatic/i.test(pseGas.headline + pseGas.bullets.join(" ")));

// Seattle oil
const sclOil = wa.estimate({
  zip: "98118",
  utility: "scl",
  heat: "oil",
  income: "over150",
});
assert.strictEqual(sclOil.pill, "public");
assert.ok(sclOil.headline.indexOf("2,000") !== -1);
assert.ok(sclOil.bullets.some((b) => /not confirmed additive/i.test(b)));

const sclOilAmi = wa.estimate({
  zip: "",
  utility: "scl",
  heat: "oil",
  income: "under150",
});
assert.strictEqual(sclOilAmi.pill, "range");
assert.ok(sclOilAmi.headline.indexOf("6,000") !== -1);

const sclElec = wa.estimate({
  zip: "",
  utility: "scl",
  heat: "electric-furnace",
  income: "over150",
});
assert.ok(sclElec.bullets.some((b) => b.indexOf("$300") !== -1 && b.indexOf("$600") !== -1));

const other = wa.estimate({
  zip: "",
  utility: "other",
  heat: "gas",
  income: "under150",
});
assert.strictEqual(other.pill, "unknown");
assert.ok(/do not invent/i.test(other.bullets.join(" ")));
assert.ok(/HomeRebates@Commerce\.wa\.gov/i.test(other.hear.body));

const all = [pseEl, pseBoost, pseHp, pseOil, pseGas, sclOil, sclOilAmi, other];
all.forEach((r) => {
  assert.ok(r.notIncluded.some((x) => /Do not budget \$8,000/.test(x)));
  assert.ok(r.notIncluded.some((x) => /25C/.test(x)));
});

const waHtml = fs.readFileSync(
  path.join(root, "wa-heat-pump-rebate/index.html"),
  "utf8"
);
const waSources = waHtml.match(
  /<section class="sources">[\s\S]*?<\/section>/
);
assert.ok(waSources, "heat pump page must have a sources block");
assert.ok(
  /Last opened \d{4}-\d{2}-\d{2}/.test(waSources[0]),
  "heat pump sources block must include Last opened YYYY-MM-DD"
);
assert.ok(
  waHtml.includes("Last opened 2026-08-29"),
  "heat pump sources last-opened date is the day the official URLs were opened"
);

const waIncomeLabel = waHtml.match(
  /<label for="income"[\s\S]*?>([\s\S]*?)<\/label\s*>/
);
assert.ok(waIncomeLabel, "heat pump income field must have a label");
const waIncomeLabelText = waIncomeLabel[1].replace(/\s+/g, " ").trim();
assert.ok(
  !/AMI/.test(waIncomeLabelText),
  "income label must not contain AMI: " + waIncomeLabelText
);
const waIncomeSelect = waHtml.match(
  /<select id="income"[^>]*>([\s\S]*?)<\/select>/
);
assert.ok(waIncomeSelect, "heat pump income field must have a select");
assert.ok(
  !/AMI/.test(waIncomeSelect[1]),
  "income select/options must not contain AMI"
);
const waFormNote = waHtml.match(
  /<form class="card" id="form"[\s\S]*?<p class="note">([\s\S]*?)<\/p>/
);
assert.ok(waFormNote, "heat pump form must have a required note");
assert.ok(
  !/AMI/.test(waFormNote[1]),
  "required note must not contain AMI"
);

const paintHtml = fs.readFileSync(path.join(root, "paint-coverage/index.html"), "utf8");
assert.ok(paintHtml.includes("Last opened 2026-08-24"));
assert.ok(paintHtml.includes("<th>Product</th>"));
assert.ok(paintHtml.includes("<th>What we use</th>"));
assert.ok(paintHtml.includes("<th>Official page</th>"));
assert.ok(paintHtml.includes("https://www.sherwin-williams.com/document/PDS/en/035777315682/"));
assert.ok(paintHtml.includes("https://www.sherwin-williams.com/en-us/project-center/faqs/paint-faq"));
assert.ok(paintHtml.includes("350–400"));
assert.ok(/typical openings/i.test(paintHtml));
assert.ok(/not a contractor quote/i.test(paintHtml));

// Issue #4: coverage field uses the exact buyer-facing copy (no PDS / mils / SuperPaint jargon)
const coverageField = paintHtml.match(
  /<label for="coverage">([\s\S]*?)<\/label>[\s\S]*?<span class="hint after"\s*>([\s\S]*?)<\/span\s*>/
);
assert.ok(coverageField, "coverage field must have a label and helper under the box");
const coverageLabel = coverageField[1].replace(/\s+/g, " ").trim();
const coverageHint = coverageField[2].replace(/\s+/g, " ").trim();
assert.strictEqual(coverageLabel, "How far one gallon goes (sq ft)");
assert.ok(
  !/\bCoverage\b/.test(coverageLabel),
  "coverage label must not say Coverage"
);
assert.ok(
  coverageHint ===
    "How much wall one gallon covers. Leave this at 350 unless your paint can says a different number. 350 is Sherwin-Williams’ official low estimate, so we tell you to buy enough.",
  "coverage helper must be the exact buyer-facing sentence"
);
assert.ok(coverageHint.includes("How much wall one gallon covers"));
assert.ok(coverageHint.includes("Leave this at 350"));
assert.ok(coverageHint.includes("Sherwin-Williams’ official low estimate"));
assert.ok(
  !/PDS|\bmils\b|conservative SuperPaint|SuperPaint/i.test(coverageHint),
  "coverage helper must not use PDS, mils, or SuperPaint jargon"
);

const concreteHtml = fs.readFileSync(path.join(root, "concrete-bags/index.html"), "utf8");
assert.ok(concreteHtml.includes("Last opened 2026-08-24"));
assert.ok(concreteHtml.includes("<th>Product</th>"));
assert.ok(concreteHtml.includes("<th>What we use</th>"));
assert.ok(concreteHtml.includes("<th>Official page</th>"));
assert.ok(concreteHtml.includes("https://www.quikrete.com/pdfs/data_sheet-concrete%20mix%201101.pdf"));
assert.ok(concreteHtml.includes("https://www.sakrete.com/product/high-strength-concrete-mix/"));
assert.ok(concreteHtml.includes("https://www.sakrete.com/wp-content/uploads/2024/01/Sakrete-High-Strength-Concrete-Mix-TDS.pdf"));
assert.ok(concreteHtml.includes("0.30"));
assert.ok(concreteHtml.includes("0.45"));
assert.ok(concreteHtml.includes("0.60"));
assert.ok(/estimate, not a contractor quote/i.test(concreteHtml));

const host = require(path.join(root, "scripts/public-host.js"));
assert.strictEqual(host.PUBLIC_ORIGIN, "https://sourcedcalc.com");
assert.deepStrictEqual(host.REDIRECT_HOSTS, [
  "www.sourcedcalc.com",
  "quickmeasure-a3q.pages.dev",
]);
assert.strictEqual(
  host.canonicalRedirect("https://quickmeasure-a3q.pages.dev/"),
  "https://sourcedcalc.com/"
);
assert.strictEqual(
  host.canonicalRedirect("https://quickmeasure-a3q.pages.dev/paint-coverage/?x=1"),
  "https://sourcedcalc.com/paint-coverage/?x=1"
);
assert.strictEqual(
  host.canonicalRedirect("https://quickmeasure-a3q.pages.dev/tax-brackets/"),
  "https://sourcedcalc.com/tax-brackets/"
);
assert.strictEqual(
  host.canonicalRedirect("https://quickmeasure-a3q.pages.dev/tax-brackets/?x=1"),
  "https://sourcedcalc.com/tax-brackets/?x=1"
);
assert.strictEqual(
  host.canonicalRedirect("https://quickmeasure-a3q.pages.dev/fsa-limits/"),
  "https://sourcedcalc.com/fsa-limits/"
);
assert.strictEqual(
  host.canonicalRedirect("https://quickmeasure-a3q.pages.dev/fsa-limits/?x=1"),
  "https://sourcedcalc.com/fsa-limits/?x=1"
);
assert.strictEqual(
  host.canonicalRedirect("https://www.sourcedcalc.com/concrete-bags/"),
  "https://sourcedcalc.com/concrete-bags/"
);
assert.strictEqual(
  host.canonicalRedirect("https://www.sourcedcalc.com/paint-coverage/?x=1"),
  "https://sourcedcalc.com/paint-coverage/?x=1"
);
assert.strictEqual(host.canonicalRedirect("https://sourcedcalc.com/"), null);
assert.strictEqual(
  host.canonicalRedirect("https://preview.quickmeasure-a3q.pages.dev/"),
  null
);

const middleware = fs.readFileSync(
  path.join(root, "functions/_middleware.js"),
  "utf8"
);
assert.ok(middleware.includes('WWW_HOST = "www.sourcedcalc.com"'));
assert.ok(middleware.includes('PUBLIC_HOST = "sourcedcalc.com"'));
assert.ok(middleware.includes('PAGES_DEV_HOST = "quickmeasure-a3q.pages.dev"'));
assert.ok(middleware.includes("Response.redirect"));
assert.ok(middleware.includes("301"));
assert.ok(
  /PAGES_DEV_HOST\s*=/.test(middleware),
  "middleware must treat production pages.dev as a redirect host"
);
assert.ok(
  !/intentionally not redirected/.test(middleware),
  "middleware must not say production pages.dev is intentionally not redirected"
);
assert.ok(
  /quickmeasure-a3q\.pages\.dev/.test(middleware),
  "middleware should comment that production pages.dev 301s to the apex"
);
assert.ok(
  !fs.existsSync(path.join(root, "_redirects")),
  "_redirects cannot match hostname; host 301s belong in Functions middleware"
);

const worker = fs.readFileSync(path.join(root, "_worker.js"), "utf8");
assert.ok(worker.includes('WWW_HOST = "www.sourcedcalc.com"'));
assert.ok(worker.includes('PUBLIC_HOST = "sourcedcalc.com"'));
assert.ok(worker.includes('PAGES_DEV_HOST = "quickmeasure-a3q.pages.dev"'));
assert.ok(worker.includes("Response.redirect"));
assert.ok(worker.includes("301"));
assert.ok(
  /PAGES_DEV_HOST\s*=/.test(worker),
  "_worker.js must treat production pages.dev as a redirect host"
);
assert.ok(
  /export default/.test(worker),
  "Pages Advanced Mode _worker.js needs a default fetch export"
);
assert.ok(
  /ASSETS\.fetch/.test(worker),
  "_worker.js must pass non-redirect hosts through to static assets"
);

const wrangler = fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
assert.ok(
  /"pages_build_output_dir"\s*:\s*"\."/.test(wrangler),
  "wrangler.jsonc must be a Pages project so _worker.js and functions/ compile"
);
assert.ok(
  !/"assets"\s*:/.test(wrangler),
  "assets-only wrangler.jsonc serves pages.dev at 200 and skips host 301s"
);

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.strictEqual(
  pkg.devDependencies.wrangler,
  "4.126.0",
  "do not loosen the wrangler pin"
);
assert.strictEqual(pkg.scripts["pages:deploy"], "wrangler pages deploy .");
assert.strictEqual(
  pkg.scripts.test,
  "node scripts/check.js",
  "npm test must run the existing check"
);
assert.ok(
  fs.readFileSync(path.join(root, ".npmrc"), "utf8").includes("ignore-scripts=true")
);

const assetsIgnore = fs.readFileSync(path.join(root, ".assetsignore"), "utf8");
assert.ok(
  /(^|\n)\.github(\n|$)/.test(assetsIgnore),
  ".github must not publish as a Pages asset"
);

const prCi = fs.readFileSync(path.join(root, ".github/workflows/pr-ci.yml"), "utf8");
assert.ok(/pull_request/.test(prCi), "PR CI must run on pull_request");
assert.ok(/npm ci/.test(prCi), "PR CI must use npm ci");
assert.ok(/npm test/.test(prCi), "PR CI must run npm test (check.js)");
assert.ok(
  !/npx\s+(--yes\s+)?wrangler@/.test(prCi),
  "PR CI must not float wrangler via npx"
);
assert.ok(
  !/enableAutoMerge|gh pr merge --auto/.test(prCi),
  "do not add an automatic merge job"
);

const pagesDeployYml = fs.readFileSync(
  path.join(root, ".github/workflows/pages-deploy.yml"),
  "utf8"
);
assert.ok(
  /branches:[\s\S]*\bmain\b/.test(pagesDeployYml),
  "Pages deploy must run on main"
);
assert.ok(/npm ci/.test(pagesDeployYml), "Pages deploy must use npm ci");
assert.ok(
  /npm test/.test(pagesDeployYml),
  "Pages deploy must run check.js before wrangler"
);
assert.ok(
  /npm run pages:deploy/.test(pagesDeployYml),
  "Pages deploy must use the pinned pages:deploy script"
);
assert.ok(
  /--project-name=quickmeasure/.test(pagesDeployYml),
  "Pages deploy must target project quickmeasure"
);
assert.ok(
  /secrets\.CLOUDFLARE_API_TOKEN/.test(pagesDeployYml),
  "Pages deploy must read CLOUDFLARE_API_TOKEN from Actions secrets"
);
assert.ok(
  /secrets\.CLOUDFLARE_ACCOUNT_ID/.test(pagesDeployYml),
  "Pages deploy must read CLOUDFLARE_ACCOUNT_ID from Actions secrets"
);
assert.ok(
  !/npx\s+(--yes\s+)?wrangler@/.test(pagesDeployYml),
  "Pages deploy must not float wrangler via npx"
);
assert.ok(
  !/enableAutoMerge|gh pr merge --auto/.test(pagesDeployYml),
  "do not add an automatic merge job"
);

const { execFileSync } = require("child_process");
execFileSync(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    'import w from "./_worker.js";' +
      "const env={ASSETS:{fetch:async()=>new Response(\"ok\")}};" +
      'const r=await w.fetch(new Request("https://quickmeasure-a3q.pages.dev/tax-brackets/"),env);' +
      "if(r.status!==301) throw new Error(String(r.status));" +
      'if(r.headers.get("location")!=="https://sourcedcalc.com/tax-brackets/") throw new Error(r.headers.get("location"));',
  ],
  { cwd: root }
);

const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
assert.ok(sitemap.includes("https://sourcedcalc.com/paint-coverage/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/concrete-bags/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/wa-heat-pump-rebate/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/mortgage-limit/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/retirement-limits/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/mileage/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/hsa-limits/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/standard-deduction/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/tax-brackets/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/fsa-limits/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/</loc>"));
assert.ok(
  !/pages\.dev/.test(sitemap),
  "sitemap must not list *.pages.dev as the public host"
);

const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
assert.ok(robots.includes("Sitemap: https://sourcedcalc.com/sitemap.xml"));
assert.ok(!/pages\.dev/.test(robots), "robots.txt must cite sourcedcalc.com");

const htmlPages = [
  ["index.html", "https://sourcedcalc.com/"],
  ["paint-coverage/index.html", "https://sourcedcalc.com/paint-coverage/"],
  ["concrete-bags/index.html", "https://sourcedcalc.com/concrete-bags/"],
  [
    "wa-heat-pump-rebate/index.html",
    "https://sourcedcalc.com/wa-heat-pump-rebate/",
  ],
  ["mortgage-limit/index.html", "https://sourcedcalc.com/mortgage-limit/"],
  [
    "retirement-limits/index.html",
    "https://sourcedcalc.com/retirement-limits/",
  ],
  ["mileage/index.html", "https://sourcedcalc.com/mileage/"],
  ["hsa-limits/index.html", "https://sourcedcalc.com/hsa-limits/"],
  [
    "standard-deduction/index.html",
    "https://sourcedcalc.com/standard-deduction/",
  ],
  ["tax-brackets/index.html", "https://sourcedcalc.com/tax-brackets/"],
  ["fsa-limits/index.html", "https://sourcedcalc.com/fsa-limits/"],
];
var GA4_ID = "G-3SB1LCNKZK";

function measurementIds(text) {
  return text.match(/G-[A-Z0-9]+/g) || [];
}

function assertOnlySourcedCalcGa4(text, name) {
  measurementIds(text).forEach(function (id) {
    assert.strictEqual(
      id,
      GA4_ID,
      name + " invented measurement id " + id
    );
  });
}

function assertLiveGa4(html, name) {
  assert.ok(html.includes(GA4_ID), name + " must contain " + GA4_ID);
  assert.ok(/gtag/i.test(html), name + " must contain gtag");
  assert.ok(/ga\.js/.test(html), name + " must load the shared ga snippet");
  assert.ok(
    !/Analytics:\s*none/i.test(html),
    name + " must not keep the old Analytics: none comment"
  );
  assertOnlySourcedCalcGa4(html, name);
}

htmlPages.forEach(function (pair) {
  var html = fs.readFileSync(path.join(root, pair[0]), "utf8");
  assert.ok(
    html.indexOf('rel="canonical" href="' + pair[1] + '"') !== -1,
    pair[0] + " canonical"
  );
  assert.ok(html.includes("Sourced Calc"), pair[0] + " brand");
  assert.ok(
    html.indexOf("Quick Measure") === -1,
    pair[0] + " must not say Quick Measure"
  );
  assert.ok(!/pages\.dev/.test(html), pair[0] + " must not cite pages.dev");
  assertLiveGa4(html, pair[0]);
});

const gaJs = fs.readFileSync(path.join(root, "ga.js"), "utf8");
assert.ok(gaJs.includes(GA4_ID), "ga.js must configure " + GA4_ID);
assert.ok(/function gtag/.test(gaJs), "ga.js must define gtag");
assert.ok(
  /gtag\(\s*["']config["']\s*,\s*["']G-3SB1LCNKZK["']\s*\)/.test(gaJs),
  "ga.js must gtag config the sourcedcalc.com id"
);
assertOnlySourcedCalcGa4(gaJs, "ga.js");

assert.throws(function () {
  assertOnlySourcedCalcGa4(
    '<script src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>',
    "invented"
  );
}, /invented measurement id/);

var notFound = fs.readFileSync(path.join(root, "404.html"), "utf8");
assert.ok(notFound.includes("Sourced Calc"));
assert.ok(notFound.indexOf("Quick Measure") === -1);
assertLiveGa4(notFound, "404.html");
assert.ok(
  /<a class="skip" href="#main">Skip to content<\/a>/.test(notFound),
  "404.html must have skip-to-content like other templates"
);
assert.ok(
  /<main id="main"/.test(notFound),
  "404.html must expose #main for the skip link"
);
assert.ok(
  /src="\/ga\.js"/.test(notFound),
  "404.html must load /ga.js from the site root so nested bogus paths still work"
);
assertNoAds(notFound, "404.html");

// Issue #23: a request to a nonexistent path must (a) return 404 and
// (b) include G-3SB1LCNKZK. Fails on the pre-fix 404 template (no GA).
execFileSync(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    'import w from "./_worker.js";' +
      "import fs from \"fs\";" +
      "const html=fs.readFileSync(\"404.html\",\"utf8\");" +
      "const env={ASSETS:{fetch:async(req)=>{" +
      "const p=new URL(req.url).pathname;" +
      "if(p===\"/\"||p===\"/index.html\") return new Response(\"ok\");" +
      "return new Response(html,{status:404,headers:{\"content-type\":\"text/html; charset=utf-8\"}});" +
      "}}};" +
      'const r=await w.fetch(new Request("https://sourcedcalc.com/this-page-does-not-exist-audit-404"),env);' +
      "if(r.status!==404) throw new Error(\"expected 404, got \"+r.status);" +
      "const body=await r.text();" +
      "if(!body.includes(\"G-3SB1LCNKZK\")) throw new Error(\"404 HTML missing G-3SB1LCNKZK\");" +
      "const home=await w.fetch(new Request(\"https://sourcedcalc.com/\"),env);" +
      "if(home.status!==200) throw new Error(\"home should stay 200, got \"+home.status);",
  ],
  { cwd: root }
);

assert.strictEqual(concrete.YIELD[40], 0.3);
assert.strictEqual(concrete.YIELD[60], 0.45);
assert.strictEqual(concrete.YIELD[80], 0.6);

const officialCsv = fs.readFileSync(
  path.join(
    root,
    "mortgage-limit",
    "fullcountyloanlimitlist2026_hera-based_final_flat.csv"
  ),
  "utf8"
);
const csvCounties = loanCsv.parseOfficialCsv(officialCsv);
const csvByFips = Object.create(null);
csvCounties.forEach(function (c) {
  csvByFips[c.fips] = c;
});

assert.strictEqual(loan.BASELINE_1_UNIT, 832750);
assert.strictEqual(loan.CEILING_1_UNIT, 1249125);
assert.strictEqual(loan.YEAR, 2026);
assert.strictEqual(loan.countyCount, csvCounties.length);
assert.ok(csvCounties.length > 3000);
csvCounties.forEach(function (c) {
  var baked = loan.lookup({ fips: c.fips, units: 1 });
  assert.ok(!baked.error, c.fips);
  assert.strictEqual(baked.limit, c.limits[0]);
  assert.strictEqual(loan.lookup({ fips: c.fips, units: 2 }).limit, c.limits[1]);
  assert.strictEqual(loan.lookup({ fips: c.fips, units: 3 }).limit, c.limits[2]);
  assert.strictEqual(loan.lookup({ fips: c.fips, units: 4 }).limit, c.limits[3]);
});

function assertCsvLookup(fips, units) {
  var rec = csvByFips[fips];
  assert.ok(rec, "CSV must contain " + fips);
  var out = loan.lookup({ fips: fips, units: units });
  assert.ok(!out.error, out.error);
  assert.strictEqual(out.limit, rec.limits[units - 1]);
  return out;
}

// Autauga County, AL — nationwide 1-home floor in the official file
assert.strictEqual(csvByFips["01001"].rawName, "AUTAUGA COUNTY");
assert.deepStrictEqual(csvByFips["01001"].limits, [
  832750, 1066250, 1288800, 1601750,
]);
[1, 2, 3, 4].forEach(function (u) {
  assertCsvLookup("01001", u);
});
assert.strictEqual(loan.lookup({ fips: "01001", units: 1 }).limit, 832750);

// King County, WA — high-cost, not the ceiling; all 4 unit counts from CSV
assert.strictEqual(csvByFips["53033"].rawName, "KING COUNTY");
assert.deepStrictEqual(csvByFips["53033"].limits, [
  1063750, 1361800, 1646100, 2045700,
]);
[1, 2, 3, 4].forEach(function (u) {
  assertCsvLookup("53033", u);
});
assert.strictEqual(loan.lookup({ fips: "53033", units: 1 }).limit, 1063750);
assert.strictEqual(loan.lookup({ fips: "53033", units: 4 }).limit, 2045700);

// San Francisco County, CA — published 1-home high-cost ceiling
assert.strictEqual(loan.lookup({ fips: "06075", units: 1 }).limit, 1249125);
assertCsvLookup("06075", 1);
assertCsvLookup("06075", 4);

// Never invent a missing county
var missing = loan.lookup({ fips: "99999", units: 1 });
assert.ok(missing.error);
assert.ok(missing.limit == null);

// Optional borrow amount is a comparison only
var under = loan.lookup({ fips: "01001", units: 1, amount: 800000 });
assert.strictEqual(under.over, false);
assert.ok(/under this cap/i.test(under.comparison));
var atCap = loan.lookup({ fips: "01001", units: 1, amount: 832750 });
assert.strictEqual(atCap.over, false);
assert.ok(/at this cap/i.test(atCap.comparison));
assert.ok(
  !/under this cap/i.test(atCap.comparison),
  "exact Autauga 1-home cap must not say under"
);
var overAmt = loan.lookup({ fips: "01001", units: 1, amount: 900000 });
assert.strictEqual(overAmt.over, true);
assert.ok(/over this cap/i.test(overAmt.comparison));

assert.strictEqual(
  loan.HUMAN_LINE,
  "Under this dollar, a normal mortgage; over it, a harder loan, usually a worse rate."
);
assert.strictEqual(
  loan.lookup({ fips: "01001", units: 1 }).humanLine,
  loan.HUMAN_LINE
);

const loanHtml = fs.readFileSync(
  path.join(root, "mortgage-limit/index.html"),
  "utf8"
);
assert.ok(loanHtml.includes("Last opened 2026-08-24"));
assert.ok(
  loanHtml.includes(
    "https://www.fhfa.gov/news/news-release/fhfa-announces-conforming-loan-limit-values-for-2026"
  )
);
assert.ok(
  loanHtml.includes(
    "https://www.fhfa.gov/document/d/cll/fullcountyloanlimitlist2026_hera-based_final_flat.csv"
  )
);
assert.ok(loanHtml.includes("https://www.fhfa.gov/CLL"));
assert.ok(loanHtml.includes("$832,750"));
assert.ok(loanHtml.includes("$1,249,125"));
assert.ok(
  loanHtml.includes(
    "Under this dollar, a normal mortgage; over it, a harder loan, usually a worse rate."
  )
);
assert.ok(/out\.humanLine/.test(loanHtml), "result must render the human line");
assert.ok(/estimate, not a loan quote/i.test(loanHtml));

const loanLabels = [];
loanHtml.replace(/<label[^>]*>([\s\S]*?)<\/label>/g, function (_, inner) {
  loanLabels.push(inner.replace(/\s+/g, " ").trim());
  return _;
});
assert.ok(loanLabels.length >= 3, "mortgage page needs field labels");
loanLabels.forEach(function (lab) {
  assert.ok(
    !/^(Conforming|FHFA|Jumbo)(\s+loan\s+limit)?$/i.test(lab),
    "label must not be jargon-only: " + lab
  );
});
assert.ok(
  loanLabels.some(function (l) {
    return /which county is the home in/i.test(l);
  })
);
assert.ok(
  loanLabels.some(function (l) {
    return /which state is the home in/i.test(l);
  })
);
assert.ok(
  loanLabels.some(function (l) {
    return /how many homes are in the building/i.test(l);
  })
);
assert.ok(
  loanLabels.some(function (l) {
    return /how much would you borrow/i.test(l);
  })
);
var amountField = loanHtml.match(
  /<label for="amount">([\s\S]*?)<\/label>[\s\S]*?<span class="hint after"\s*>([\s\S]*?)<\/span\s*>/
);
assert.ok(amountField, "optional borrow field needs a helper under the box");
var amountHint = amountField[2].replace(/\s+/g, " ").trim();
assert.strictEqual(
  amountHint,
  "Leave this blank to only see the county cap. If you type a dollar amount, we tell you whether it is under or over that cap."
);
assert.ok(!/PDS|\bmils\b/.test(amountHint));

function assertNoAds(html, name) {
  assert.ok(
    !/adsbygoogle|doubleclick|googlesyndication|carbonads/i.test(html),
    name
  );
  assert.ok(!/type="email"/i.test(html), name + " no email capture");
  assert.ok(!/\blead form\b|\bget a quote\b/i.test(html), name);
}

[
  ["index.html", fs.readFileSync(path.join(root, "index.html"), "utf8")],
  ["mortgage-limit", loanHtml],
  ["paint-coverage", paintHtml],
  ["concrete-bags", concreteHtml],
  [
    "wa-heat-pump-rebate",
    fs.readFileSync(path.join(root, "wa-heat-pump-rebate/index.html"), "utf8"),
  ],
  [
    "retirement-limits",
    fs.readFileSync(path.join(root, "retirement-limits/index.html"), "utf8"),
  ],
  [
    "mileage",
    fs.readFileSync(path.join(root, "mileage/index.html"), "utf8"),
  ],
  [
    "hsa-limits",
    fs.readFileSync(path.join(root, "hsa-limits/index.html"), "utf8"),
  ],
  [
    "standard-deduction",
    fs.readFileSync(path.join(root, "standard-deduction/index.html"), "utf8"),
  ],
  [
    "tax-brackets",
    fs.readFileSync(path.join(root, "tax-brackets/index.html"), "utf8"),
  ],
  [
    "fsa-limits",
    fs.readFileSync(path.join(root, "fsa-limits/index.html"), "utf8"),
  ],
].forEach(function (pair) {
  assertNoAds(pair[1], pair[0]);
});

assert.ok(robots.includes("Sitemap: https://sourcedcalc.com/sitemap.xml"));

assert.strictEqual(retirement.YEAR, 2026);
assert.strictEqual(retirement.WORKPLACE_BASE, 24500);
assert.strictEqual(retirement.WORKPLACE_CATCHUP_50, 8000);
assert.strictEqual(retirement.WORKPLACE_CATCHUP_60_63, 11250);
assert.strictEqual(retirement.IRA_BASE, 7500);
assert.strictEqual(retirement.IRA_CATCHUP_50, 1100);
assert.ok(retirement.IRA_CATCHUP_50 !== retirement.WORKPLACE_CATCHUP_50);
assert.ok(retirement.IRA_CATCHUP_50 !== retirement.WORKPLACE_CATCHUP_60_63);

function ret(account, age, amount) {
  return retirement.lookup({ account: account, age: age, amount: amount });
}

assert.strictEqual(ret("workplace", 49).limit, 24500);
assert.strictEqual(ret("workplace", 50).limit, 32500);
assert.strictEqual(ret("workplace", 59).limit, 32500);
assert.strictEqual(ret("workplace", 60).limit, 24500 + 11250);
assert.strictEqual(ret("workplace", 61).limit, 24500 + 11250);
assert.strictEqual(ret("workplace", 62).limit, 24500 + 11250);
assert.strictEqual(ret("workplace", 63).limit, 24500 + 11250);
assert.strictEqual(ret("workplace", 64).limit, 32500);
assert.strictEqual(ret("ira", 49).limit, 7500);
assert.strictEqual(ret("ira", 50).limit, 8600);
assert.strictEqual(ret("ira", 60).limit, 8600);
assert.strictEqual(ret("ira", 63).limit, 8600);
assert.strictEqual(ret("ira", 64).limit, 8600);
assert.strictEqual(ret("ira", 50).extra, 1100);
assert.strictEqual(ret("workplace", 50).extra, 8000);
assert.strictEqual(ret("workplace", 60).extra, 11250);
assert.ok(ret("ira", 60).limit !== ret("workplace", 60).limit);

function resultCopy(out) {
  return [
    out.headline,
    out.humanLine,
    out.extraNote,
    out.comparison,
    out.disclaimer,
    out.accountLabel,
    out.limitLabel,
  ].join(" ");
}

[49, 50, 59, 60, 61, 62, 63, 64].forEach(function (age) {
  var copy = resultCopy(ret("workplace", age));
  assert.ok(
    !/\$1,100|\b1100\b/.test(copy),
    "workplace result must not mention the IRA $1,100 extra (age " + age + ")"
  );
  if (age >= 50) {
    assert.ok(
      /Workplace 401\(k\) extra at 50 or older is \$8,000/.test(
        ret("workplace", age).extraNote
      )
    );
    assert.ok(
      /Those workplace extras are not for an IRA/.test(
        ret("workplace", age).extraNote
      )
    );
    assert.ok(/\$11,250 instead of \$8,000/.test(ret("workplace", age).extraNote));
  }
});

[49, 50, 60, 63, 64].forEach(function (age) {
  var copy = resultCopy(ret("ira", age));
  assert.ok(
    !/\$8,000|\b8000\b/.test(copy),
    "IRA result must not mention the workplace $8,000 extra (age " + age + ")"
  );
  assert.ok(
    !/\$11,250|\b11250\b/.test(copy),
    "IRA result must not mention the workplace $11,250 extra (age " + age + ")"
  );
  if (age >= 50) {
    assert.strictEqual(
      ret("ira", age).extraNote,
      "IRA extra at 50 or older is $1,100. That is only for an IRA."
    );
  }
});

var retUnder = ret("workplace", 49, 20000);
assert.strictEqual(retUnder.over, false);
assert.ok(/under this cap/i.test(retUnder.comparison));
var retAt = ret("workplace", 49, 24500);
assert.strictEqual(retAt.over, false);
assert.ok(/at this cap/i.test(retAt.comparison));
assert.ok(
  !/under this cap/i.test(retAt.comparison),
  "exact workplace cap must not say under"
);
var retOver = ret("workplace", 49, 25000);
assert.strictEqual(retOver.over, true);
assert.ok(/over this cap/i.test(retOver.comparison));

var simplePlan = retirement.lookup({ account: "simple", age: 50 });
assert.ok(simplePlan.error);
assert.ok(/do not have an official dollar/i.test(simplePlan.error));
assert.ok(simplePlan.limit == null);

assert.strictEqual(
  retirement.HUMAN_LINE,
  "Under this dollar, you are within the official yearly cap; over it, the IRS does not let you put more in that account this year."
);
assert.strictEqual(ret("workplace", 49).humanLine, retirement.HUMAN_LINE);
assert.ok(/estimate, not tax advice/i.test(ret("ira", 50).disclaimer));

const retHtml = fs.readFileSync(
  path.join(root, "retirement-limits/index.html"),
  "utf8"
);
assert.ok(retHtml.includes("Last opened 2026-08-25"));
assert.ok(
  retHtml.includes(
    "https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500"
  )
);
assert.ok(retHtml.includes("https://www.irs.gov/pub/irs-drop/n-25-67.pdf"));
assert.ok(retHtml.includes("$24,500"));
assert.ok(retHtml.includes("$8,000"));
assert.ok(retHtml.includes("$11,250"));
assert.ok(retHtml.includes("$7,500"));
assert.ok(retHtml.includes("$1,100"));
assert.ok(retHtml.includes(retirement.HUMAN_LINE));
assert.ok(/out\.humanLine/.test(retHtml), "result must render the human line");
assert.ok(/estimate, not tax advice/i.test(retHtml));

const retLabels = [];
retHtml.replace(/<label[^>]*>([\s\S]*?)<\/label>/g, function (_, inner) {
  retLabels.push(inner.replace(/\s+/g, " ").trim());
  return _;
});
assert.ok(retLabels.length >= 3, "retirement page needs field labels");
retLabels.forEach(function (lab) {
  assert.ok(
    !/^(deferral|COLA|SECURE 2\.0)$/i.test(lab),
    "label must not be jargon-only: " + lab
  );
});
assert.ok(
  retLabels.some(function (l) {
    return /which account is this for/i.test(l);
  })
);
assert.ok(
  retLabels.some(function (l) {
    return /how old will you be/i.test(l);
  })
);
assert.ok(
  retLabels.some(function (l) {
    return /how much do you already plan to put in/i.test(l);
  })
);
assert.ok(
  /IRA extra at 50 or older is \$1,100\. That is only for an IRA/.test(retHtml)
);
assert.ok(
  /Workplace 401\(k\) extra at 50 or older is \$8,000/.test(retHtml)
);
assert.ok(/Ages 60–63 use \$11,250 instead of \$8,000/.test(retHtml));
assert.ok(/Those workplace extras are not for an IRA/.test(retHtml));

const homeHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(homeHtml.includes("./retirement-limits/"));
assert.ok(
  homeHtml.includes(
    "How much you can put in a 401(k) or IRA this year (2026)"
  )
);
assertNoAds(homeHtml, "index.html");
assertNoAds(retHtml, "retirement-limits");

assert.strictEqual(mileage.YEAR, 2026);
assert.strictEqual(mileage.RATES.first.business, 72.5);
assert.strictEqual(mileage.RATES.second.business, 76);
assert.strictEqual(mileage.RATES.first.charity, 14);
assert.strictEqual(mileage.RATES.second.charity, 14);
assert.strictEqual(mileage.RATES.first.medical, 20.5);
assert.strictEqual(mileage.RATES.second.medical, 23.5);
assert.strictEqual(mileage.RATES.first.moving, 20.5);
assert.strictEqual(mileage.RATES.second.moving, 23.5);
assert.strictEqual(mileage.RATES.first.charity, mileage.RATES.second.charity);

function mile(date, type, miles) {
  return mileage.lookup({ date: date, type: type, miles: miles });
}

assert.strictEqual(mile("2026-01-01", "business").rateCents, 72.5);
assert.strictEqual(mile("2026-06-30", "business").rateCents, 72.5);
assert.strictEqual(mile("2026-07-01", "business").rateCents, 76);
assert.strictEqual(mile("2026-12-31", "business").rateCents, 76);
assert.strictEqual(mile("2026-01-15", "charity").rateCents, 14);
assert.strictEqual(mile("2026-07-15", "charity").rateCents, 14);
assert.strictEqual(mile("2026-03-01", "medical").rateCents, 20.5);
assert.strictEqual(mile("2026-08-01", "medical").rateCents, 23.5);
assert.strictEqual(mile("2026-03-01", "moving").rateCents, 20.5);
assert.strictEqual(mile("2026-08-01", "moving").rateCents, 23.5);

var janBiz = mile("2026-01-15", "business", 100);
assert.ok(!janBiz.error);
assert.strictEqual(janBiz.rateCents, 72.5);
assert.strictEqual(janBiz.total, 72.5);
assert.ok(/\$72\.50/.test(janBiz.totalLabel + janBiz.comparison));

var julBiz = mile("2026-07-01", "business", 10);
assert.strictEqual(julBiz.rateCents, 76);
assert.strictEqual(julBiz.total, 7.6);

var y2025 = mile("2025-06-15", "business", 100);
assert.ok(y2025.error, "2025 must not invent a rate");
assert.ok(y2025.rateCents == null, "2025 must not invent cents");
assert.ok(y2025.rate == null);
assert.ok(y2025.total == null);
assert.ok(y2025.headline == null);
assert.ok(/only has the official 2026/i.test(y2025.error));

var y2027 = mile("2027-01-01", "charity");
assert.ok(y2027.error);
assert.ok(y2027.rateCents == null);

assert.strictEqual(
  mileage.HUMAN_LINE,
  "This is how much the IRS says one mile is worth."
);
assert.strictEqual(mile("2026-01-01", "business").humanLine, mileage.HUMAN_LINE);
assert.ok(/estimate, not tax advice/i.test(mile("2026-07-01", "medical").disclaimer));

const mileHtml = fs.readFileSync(path.join(root, "mileage/index.html"), "utf8");
assert.ok(mileHtml.includes("Last opened 2026-08-25"));
assert.ok(
  mileHtml.includes(
    "https://www.irs.gov/tax-professionals/standard-mileage-rates"
  )
);
assert.ok(mileHtml.includes("https://www.irs.gov/pub/irs-drop/n-26-10.pdf"));
assert.ok(mileHtml.includes("https://www.irs.gov/irb/2026-29_IRB"));
assert.ok(mileHtml.includes("<th>Product</th>"));
assert.ok(mileHtml.includes("72.5"));
assert.ok(mileHtml.includes("76"));
assert.ok(/14¢/.test(mileHtml));
assert.ok(mileHtml.includes("20.5"));
assert.ok(mileHtml.includes("23.5"));
assert.ok(mileHtml.includes(mileage.HUMAN_LINE));
assert.ok(/out\.humanLine/.test(mileHtml), "result must render the human line");
assert.ok(/estimate, not tax advice/i.test(mileHtml));
assertLiveGa4(mileHtml, "mileage");
assert.ok(/military only/i.test(mileHtml));
assert.ok(!/2025 mileage|70¢ a mile for 2025/i.test(mileHtml));

const mileLabels = [];
mileHtml.replace(/<label[^>]*>([\s\S]*?)<\/label>/g, function (_, inner) {
  mileLabels.push(inner.replace(/\s+/g, " ").trim());
  return _;
});
assert.ok(mileLabels.length >= 3, "mileage page needs field labels");
mileLabels.forEach(function (lab) {
  assert.ok(
    !/^(SMR|IRB|Announcement 2026-11)$/i.test(lab),
    "label must not be jargon-only: " + lab
  );
});
assert.ok(
  mileLabels.some(function (l) {
    return /when was the trip/i.test(l);
  })
);
assert.ok(
  mileLabels.some(function (l) {
    return /what kind of trip/i.test(l);
  })
);
assert.ok(
  mileLabels.some(function (l) {
    return /how many miles/i.test(l);
  })
);

assert.ok(homeHtml.includes("./mileage/"));
assert.ok(
  homeHtml.includes("How much the IRS says one mile is worth (2026)")
);
assertNoAds(mileHtml, "mileage");

assert.strictEqual(hsa.YEAR, 2026);
assert.strictEqual(hsa.SELF_BASE, 4400);
assert.strictEqual(hsa.FAMILY_BASE, 8750);
assert.strictEqual(hsa.AGE_55_EXTRA, 1000);
assert.strictEqual(hsa.SELF_MIN_DEDUCTIBLE, 1700);
assert.strictEqual(hsa.FAMILY_MIN_DEDUCTIBLE, 3400);
assert.strictEqual(hsa.SELF_MAX_OOP, 8500);
assert.strictEqual(hsa.FAMILY_MAX_OOP, 17000);
assert.ok(hsa.SELF_BASE !== 4300, "do not use the 2025 self-only cap as 2026");
assert.ok(hsa.FAMILY_BASE !== 8550, "do not use the 2025 family cap as 2026");
assert.ok(hsa.AGE_55_EXTRA !== 1100, "do not invent an IRA-style extra");
assert.ok(
  hsa.SELF_BASE !== 2200 && hsa.FAMILY_BASE !== 2200,
  "do not use the excepted-benefit HRA figure as an HSA cap"
);

function hsaLookup(coverage, age55) {
  return hsa.lookup({ coverage: coverage, age55: age55 });
}

assert.strictEqual(hsaLookup("self", "no").limit, 4400);
assert.strictEqual(hsaLookup("self", "yes").limit, 5400);
assert.strictEqual(hsaLookup("family", "no").limit, 8750);
assert.strictEqual(hsaLookup("family", "yes").limit, 9750);
assert.strictEqual(hsaLookup("self", "yes").extra, 1000);
assert.strictEqual(hsaLookup("family", "no").extra, 0);
assert.strictEqual(hsaLookup("self", "no").minDeductible, 1700);
assert.strictEqual(hsaLookup("family", "no").minDeductible, 3400);
assert.strictEqual(hsaLookup("self", "no").maxOop, 8500);
assert.strictEqual(hsaLookup("family", "no").maxOop, 17000);
assert.ok(hsaLookup("self", "no").limit !== hsaLookup("self", "no").minDeductible);
assert.ok(hsaLookup("self", "no").limit !== hsaLookup("self", "no").maxOop);

var hsaUnknown = hsa.lookup({ coverage: "hra", age55: "no" });
assert.ok(hsaUnknown.error);
assert.ok(/do not have an official dollar/i.test(hsaUnknown.error));
assert.ok(hsaUnknown.limit == null);

assert.strictEqual(hsa.HUMAN_LINE, "How much you can put in an HSA this year");
assert.strictEqual(hsaLookup("self", "no").humanLine, hsa.HUMAN_LINE);
assert.ok(/not tax advice/i.test(hsaLookup("family", "yes").disclaimer));
assert.ok(/Publication 969/.test(hsaLookup("self", "yes").extraNote));
assert.ok(/\$1,000/.test(hsaLookup("self", "yes").extraNote));
assert.ok(hsaLookup("self", "no").extraNote == null);
assert.ok(/deductible of at least \$1,700/.test(hsaLookup("self", "no").planNote));
assert.ok(/cannot go past \$8,500/.test(hsaLookup("self", "no").planNote));
assert.ok(/deductible of at least \$3,400/.test(hsaLookup("family", "yes").planNote));
assert.ok(/cannot go past \$17,000/.test(hsaLookup("family", "yes").planNote));

const hsaHtml = fs.readFileSync(path.join(root, "hsa-limits/index.html"), "utf8");
assert.ok(hsaHtml.includes("Last opened 2026-08-25"));
assert.ok(hsaHtml.includes("https://www.irs.gov/pub/irs-drop/rp-25-19.pdf"));
assert.ok(hsaHtml.includes("https://www.irs.gov/irb/2025-21_IRB"));
assert.ok(hsaHtml.includes("https://www.irs.gov/publications/p969"));
assert.ok(hsaHtml.includes("$4,400"));
assert.ok(hsaHtml.includes("$8,750"));
assert.ok(hsaHtml.includes("$1,700"));
assert.ok(hsaHtml.includes("$3,400"));
assert.ok(hsaHtml.includes("$8,500"));
assert.ok(hsaHtml.includes("$17,000"));
assert.ok(hsaHtml.includes("$1,000"));
assert.ok(hsaHtml.includes(hsa.HUMAN_LINE));
assert.ok(/out\.humanLine/.test(hsaHtml), "result must render the human line");
assert.ok(/not tax advice/i.test(hsaHtml));
assertLiveGa4(hsaHtml, "hsa-limits");
assert.ok(
  !/\$2,200/.test(hsaHtml),
  "do not include the excepted-benefit HRA $2,200 as an HSA limit"
);
assert.ok(!/G-[A-Z0-9]+/.test(hsaHtml.replace(/G-3SB1LCNKZK/g, "")));

const hsaLabels = [];
hsaHtml.replace(/<label[^>]*>([\s\S]*?)<\/label>/g, function (_, inner) {
  hsaLabels.push(inner.replace(/\s+/g, " ").trim());
  return _;
});
assert.ok(hsaLabels.length >= 2, "HSA page needs field labels");
hsaLabels.forEach(function (lab) {
  assert.ok(
    !/^(HDHP|deductible|OOP|catch-up|Rev\. Proc\.)$/i.test(lab),
    "label must not be jargon-only: " + lab
  );
});
assert.ok(
  hsaLabels.some(function (l) {
    return /who is on the health plan/i.test(l);
  })
);
assert.ok(
  hsaLabels.some(function (l) {
    return /55 or older this year/i.test(l);
  })
);
assert.ok(/Just you/.test(hsaHtml));
assert.ok(/You and family/.test(hsaHtml));
assert.ok(/extra \$1,000/.test(hsaHtml));
assert.ok(/Publication 969/.test(hsaHtml));
assert.ok(/plan has to have a yearly deductible/i.test(hsaHtml));
assert.ok(/not a second contribution limit/i.test(hsaHtml));

assert.ok(homeHtml.includes("./hsa-limits/"));
assert.ok(
  homeHtml.includes("How much you can put in an HSA this year (2026)")
);
assertNoAds(hsaHtml, "hsa-limits");

assert.strictEqual(std.YEAR, 2026);
assert.strictEqual(std.SINGLE, 16100);
assert.strictEqual(std.MFS, 16100);
assert.strictEqual(std.MFJ, 32200);
assert.strictEqual(std.SURVIVING_SPOUSE, 32200);
assert.strictEqual(std.HOH, 24150);
assert.strictEqual(std.EXTRA_MARRIED_OR_SS, 1650);
assert.strictEqual(std.EXTRA_UNMARRIED, 2050);
assert.strictEqual(std.DEPENDENT_FLOOR, 1350);
assert.strictEqual(std.DEPENDENT_EARNED_ADDON, 450);
assert.ok(std.SINGLE !== 15750, "do not use the 2025 single amount as 2026");
assert.ok(std.MFJ !== 31500, "do not use the 2025 joint amount as 2026");
assert.ok(std.HOH !== 23625, "do not use the 2025 head-of-household amount as 2026");
assert.ok(std.EXTRA_UNMARRIED !== 6000, "do not invent a senior bonus");
assert.ok(std.EXTRA_MARRIED_OR_SS !== 6000, "do not invent a senior bonus");

function stdLookup(status, age65, blind, extra) {
  extra = extra || {};
  return std.lookup({
    status: status,
    age65: age65,
    blind: blind,
    spouseAge65: extra.spouseAge65,
    spouseBlind: extra.spouseBlind,
    dependent: extra.dependent == null ? "no" : extra.dependent,
    earned: extra.earned,
  });
}

assert.strictEqual(stdLookup("single", "no", "no").limit, 16100);
assert.strictEqual(stdLookup("mfs", "no", "no").limit, 16100);
assert.strictEqual(stdLookup("mfj", "no", "no", {
  spouseAge65: "no",
  spouseBlind: "no",
}).limit, 32200);
assert.strictEqual(stdLookup("ss", "no", "no").limit, 32200);
assert.strictEqual(stdLookup("hoh", "no", "no").limit, 24150);

assert.strictEqual(stdLookup("single", "yes", "no").limit, 16100 + 2050);
assert.strictEqual(stdLookup("single", "no", "yes").limit, 16100 + 2050);
assert.strictEqual(stdLookup("single", "yes", "yes").limit, 16100 + 4100);
assert.strictEqual(stdLookup("hoh", "yes", "no").limit, 24150 + 2050);
assert.strictEqual(stdLookup("mfs", "yes", "no").limit, 16100 + 1650);
assert.strictEqual(stdLookup("ss", "yes", "no").limit, 32200 + 1650);
assert.strictEqual(stdLookup("ss", "yes", "yes").limit, 32200 + 3300);

assert.strictEqual(
  stdLookup("mfj", "yes", "no", { spouseAge65: "no", spouseBlind: "no" }).limit,
  32200 + 1650
);
assert.strictEqual(
  stdLookup("mfj", "yes", "no", { spouseAge65: "yes", spouseBlind: "no" }).limit,
  32200 + 3300
);
assert.strictEqual(
  stdLookup("mfj", "yes", "yes", { spouseAge65: "yes", spouseBlind: "yes" }).limit,
  32200 + 6600
);
assert.strictEqual(
  stdLookup("mfj", "no", "yes", { spouseAge65: "no", spouseBlind: "yes" }).limit,
  32200 + 3300
);

assert.strictEqual(stdLookup("single", "yes", "no").extra, 2050);
assert.strictEqual(stdLookup("mfs", "yes", "no").extra, 1650);
assert.strictEqual(stdLookup("ss", "yes", "no").extra, 1650);
assert.ok(stdLookup("single", "yes", "yes").extra === 4100);
assert.ok(stdLookup("single", "yes", "no").limit !== 16100 + 1650);
assert.ok(stdLookup("mfj", "yes", "no", {
  spouseAge65: "no",
  spouseBlind: "no",
}).limit !== 32200 + 2050);

assert.strictEqual(
  stdLookup("single", "no", "no", { dependent: "yes", earned: 0 }).limit,
  1350
);
assert.strictEqual(
  stdLookup("single", "no", "no", { dependent: "yes", earned: 4000 }).limit,
  4450
);
assert.strictEqual(
  stdLookup("single", "no", "no", { dependent: "yes", earned: 20000 }).limit,
  16100
);
assert.strictEqual(
  stdLookup("single", "yes", "no", { dependent: "yes", earned: 0 }).limit,
  1350 + 2050
);
assert.strictEqual(
  stdLookup("single", "yes", "yes", { dependent: "yes", earned: 0 }).limit,
  1350 + 4100
);
assert.strictEqual(
  stdLookup("hoh", "no", "no", { dependent: "yes", earned: 0 }).limit,
  1350
);

var stdUnknown = std.lookup({
  status: "trust",
  age65: "no",
  blind: "no",
  dependent: "no",
});
assert.ok(stdUnknown.error);
assert.ok(/do not have an official dollar/i.test(stdUnknown.error));
assert.ok(stdUnknown.limit == null);

var stdMissing = std.lookup({});
assert.ok(stdMissing.error);
assert.ok(/how you file/i.test(stdMissing.error));

assert.strictEqual(
  std.HUMAN_LINE,
  "This is the amount the IRS lets most people subtract before tax, instead of listing every deduction."
);
assert.strictEqual(stdLookup("single", "no", "no").humanLine, std.HUMAN_LINE);
assert.ok(
  /official IRS figure lookup, not tax advice and not a filing/i.test(
    stdLookup("single", "no", "no").disclaimer
  )
);
assert.ok(/\$2,050/.test(stdLookup("single", "yes", "no").extraNote));
assert.ok(/\$1,650/.test(stdLookup("mfs", "yes", "no").extraNote));
assert.ok(stdLookup("single", "no", "no").extraNote == null);
assert.ok(
  /greater of \$1,350/.test(
    stdLookup("single", "no", "no", { dependent: "yes", earned: 0 }).dependentNote
  )
);

function stdCopy(out) {
  return [
    out.headline,
    out.humanLine,
    out.extraNote,
    out.dependentNote,
    out.disclaimer,
    out.statusLabel,
    out.limitLabel,
  ].join(" ");
}

[
  stdLookup("single", "yes", "yes"),
  stdLookup("mfj", "yes", "yes", {
    spouseAge65: "yes",
    spouseBlind: "yes",
  }),
  stdLookup("ss", "yes", "yes"),
].forEach(function (out) {
  var copy = stdCopy(out);
  assert.ok(!/\$6,000/.test(copy), "do not invent a $6,000 senior bonus");
  assert.ok(!/senior bonus/i.test(copy));
  assert.ok(/not tax advice/i.test(out.disclaimer));
});

const stdHtml = fs.readFileSync(
  path.join(root, "standard-deduction/index.html"),
  "utf8"
);
assert.ok(stdHtml.includes("Last opened 2026-08-25"));
assert.ok(
  stdHtml.includes(
    "https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill"
  )
);
assert.ok(stdHtml.includes("https://www.irs.gov/pub/irs-drop/rp-25-32.pdf"));
assert.ok(stdHtml.includes("$16,100"));
assert.ok(stdHtml.includes("$32,200"));
assert.ok(stdHtml.includes("$24,150"));
assert.ok(stdHtml.includes("$1,650"));
assert.ok(stdHtml.includes("$2,050"));
assert.ok(stdHtml.includes("$1,350"));
assert.ok(stdHtml.includes("$450"));
assert.ok(stdHtml.includes(std.HUMAN_LINE));
assert.ok(/out\.humanLine/.test(stdHtml), "result must render the human line");
assert.ok(/not tax advice/i.test(stdHtml));
assert.ok(/not a filing/i.test(stdHtml));
assertLiveGa4(stdHtml, "standard-deduction");
assert.ok(!/G-CHZH4ENKK3/.test(stdHtml));
assert.ok(!/G-[A-Z0-9]+/.test(stdHtml.replace(/G-3SB1LCNKZK/g, "")));
assert.ok(
  !/\$6,000/.test(stdHtml),
  "do not invent a $6,000 senior bonus on the page"
);
assert.ok(/do not add one/i.test(stdHtml));

const stdLabels = [];
stdHtml.replace(/<label[^>]*>([\s\S]*?)<\/label>/g, function (_, inner) {
  stdLabels.push(inner.replace(/\s+/g, " ").trim());
  return _;
});
assert.ok(stdLabels.length >= 4, "standard deduction page needs field labels");
stdLabels.forEach(function (lab) {
  assert.ok(
    !/^(MFS|HoH|HOH|MFJ|AGI|QW)$/i.test(lab),
    "label must not be jargon-only: " + lab
  );
});
assert.ok(
  stdLabels.some(function (l) {
    return /how do you file this year/i.test(l);
  })
);
assert.ok(
  stdLabels.some(function (l) {
    return /65 or older this year/i.test(l);
  })
);
assert.ok(
  stdLabels.some(function (l) {
    return /are you blind/i.test(l);
  })
);
assert.ok(
  stdLabels.some(function (l) {
    return /someone else claim you as a dependent/i.test(l);
  })
);
assert.ok(/Just you/.test(stdHtml));
assert.ok(/You and a spouse together/.test(stdHtml));
assert.ok(/Head of household/.test(stdHtml));
assert.ok(/Age and blind can both apply/.test(stdHtml));
assert.ok(/unmarried and not a surviving spouse/.test(stdHtml));

assert.ok(homeHtml.includes("./standard-deduction/"));
assert.ok(
  homeHtml.includes(
    "How much the IRS lets most people subtract before tax (2026)"
  )
);
assertNoAds(stdHtml, "standard-deduction");

assert.strictEqual(tax.YEAR, 2026);
assert.strictEqual(tax.SINGLE_10_OR_LESS, 12400);
assert.strictEqual(tax.JOINT_10_OR_LESS, 24800);
assert.strictEqual(tax.SINGLE_12_OVER, 12400);
assert.strictEqual(tax.JOINT_12_OVER, 24800);
assert.strictEqual(tax.SINGLE_22_OVER, 50400);
assert.strictEqual(tax.JOINT_22_OVER, 100800);
assert.strictEqual(tax.SINGLE_24_OVER, 105700);
assert.strictEqual(tax.JOINT_24_OVER, 211400);
assert.strictEqual(tax.SINGLE_32_OVER, 201775);
assert.strictEqual(tax.JOINT_32_OVER, 403550);
assert.strictEqual(tax.SINGLE_35_OVER, 256225);
assert.strictEqual(tax.JOINT_35_OVER, 512450);
assert.strictEqual(tax.SINGLE_37_OVER, 640600);
assert.strictEqual(tax.JOINT_37_OVER, 768700);
assert.ok(tax.SINGLE_37_OVER !== 609350, "do not use a prior-year 37% line");
assert.ok(tax.JOINT_37_OVER !== 731200, "do not use a prior-year 37% line");

function taxLookup(status, income) {
  return tax.lookup({ status: status, income: income });
}

assert.strictEqual(taxLookup("single", 0).rate, 10);
assert.strictEqual(taxLookup("single", 12400).rate, 10);
assert.strictEqual(taxLookup("single", 12401).rate, 12);
assert.strictEqual(taxLookup("single", 50400).rate, 12);
assert.strictEqual(taxLookup("single", 50401).rate, 22);
assert.strictEqual(taxLookup("single", 105700).rate, 22);
assert.strictEqual(taxLookup("single", 105701).rate, 24);
assert.strictEqual(taxLookup("single", 201775).rate, 24);
assert.strictEqual(taxLookup("single", 201776).rate, 32);
assert.strictEqual(taxLookup("single", 256225).rate, 32);
assert.strictEqual(taxLookup("single", 256226).rate, 35);
assert.strictEqual(taxLookup("single", 640600).rate, 35);
assert.strictEqual(taxLookup("single", 640601).rate, 37);

assert.strictEqual(taxLookup("mfj", 0).rate, 10);
assert.strictEqual(taxLookup("mfj", 24800).rate, 10);
assert.strictEqual(taxLookup("mfj", 24801).rate, 12);
assert.strictEqual(taxLookup("mfj", 100800).rate, 12);
assert.strictEqual(taxLookup("mfj", 100801).rate, 22);
assert.strictEqual(taxLookup("mfj", 211400).rate, 22);
assert.strictEqual(taxLookup("mfj", 211401).rate, 24);
assert.strictEqual(taxLookup("mfj", 403550).rate, 24);
assert.strictEqual(taxLookup("mfj", 403551).rate, 32);
assert.strictEqual(taxLookup("mfj", 512450).rate, 32);
assert.strictEqual(taxLookup("mfj", 512451).rate, 35);
assert.strictEqual(taxLookup("mfj", 768700).rate, 35);
assert.strictEqual(taxLookup("mfj", 768701).rate, 37);

assert.strictEqual(taxLookup("just you", 12400).rate, 10);
assert.strictEqual(taxLookup("you and a spouse together", 24800).rate, 10);
assert.strictEqual(taxLookup("single", 50400).statusLabel, "Just you");
assert.strictEqual(
  taxLookup("mfj", 100800).statusLabel,
  "You and a spouse together"
);
assert.strictEqual(taxLookup("single", 640601).headline, "37%");
assert.strictEqual(taxLookup("single", 50401).rateLabel, "22%");
assert.ok(/over \$50,400/.test(taxLookup("single", 50401).thresholdNote));
assert.ok(/\$12,400 or less/.test(taxLookup("single", 12400).thresholdNote));
assert.ok(/greater than \$640,600/.test(taxLookup("single", 640601).thresholdNote));

var taxHoh = tax.lookup({ status: "hoh", income: 50000 });
assert.ok(taxHoh.error);
assert.ok(/do not have an official dollar/i.test(taxHoh.error));
assert.ok(taxHoh.rate == null);

var taxMfs = tax.lookup({ status: "mfs", income: 50000 });
assert.ok(taxMfs.error);
assert.ok(/do not have an official dollar/i.test(taxMfs.error));
assert.ok(taxMfs.rate == null);

var taxMissing = tax.lookup({});
assert.ok(taxMissing.error);
assert.ok(/how you file/i.test(taxMissing.error));

var taxNoIncome = tax.lookup({ status: "single" });
assert.ok(taxNoIncome.error);
assert.ok(/income/i.test(taxNoIncome.error));

assert.strictEqual(
  tax.HUMAN_LINE,
  "This is the rate the IRS uses on the last part of that income, not a rate on all of it."
);
assert.strictEqual(taxLookup("single", 50400).humanLine, tax.HUMAN_LINE);
assert.ok(
  /official IRS figure lookup, not tax advice and not a filing/i.test(
    taxLookup("single", 50400).disclaimer
  )
);

function taxCopy(out) {
  return [
    out.headline,
    out.humanLine,
    out.thresholdNote,
    out.disclaimer,
    out.statusLabel,
    out.rateLabel,
    out.incomeLabel,
  ].join(" ");
}

[taxLookup("single", 50401), taxLookup("mfj", 768701)].forEach(function (out) {
  var copy = taxCopy(out);
  assert.ok(!/head of household/i.test(copy));
  assert.ok(/not tax advice/i.test(out.disclaimer));
});

const taxHtml = fs.readFileSync(
  path.join(root, "tax-brackets/index.html"),
  "utf8"
);
assert.ok(taxHtml.includes("Last opened 2026-08-26"));
assert.ok(
  taxHtml.includes(
    "https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill"
  )
);
assert.ok(taxHtml.includes("$12,400"));
assert.ok(taxHtml.includes("$24,800"));
assert.ok(taxHtml.includes("$50,400"));
assert.ok(taxHtml.includes("$100,800"));
assert.ok(taxHtml.includes("$105,700"));
assert.ok(taxHtml.includes("$211,400"));
assert.ok(taxHtml.includes("$201,775"));
assert.ok(taxHtml.includes("$403,550"));
assert.ok(taxHtml.includes("$256,225"));
assert.ok(taxHtml.includes("$512,450"));
assert.ok(taxHtml.includes("$640,600"));
assert.ok(taxHtml.includes("$768,700"));
assert.ok(taxHtml.includes(tax.HUMAN_LINE));
assert.ok(/out\.humanLine/.test(taxHtml), "result must render the human line");
assert.ok(/not tax advice/i.test(taxHtml));
assert.ok(/not a filing/i.test(taxHtml));
assertLiveGa4(taxHtml, "tax-brackets");
assert.ok(!/G-[A-Z0-9]+/.test(taxHtml.replace(/G-3SB1LCNKZK/g, "")));
assert.ok(
  !/head of household/i.test(taxHtml.replace(/head of household or any other/gi, "")),
  "do not invent a head-of-household bracket table"
);
assert.ok(/do not have official dollars here for head of household/i.test(taxHtml));
assert.ok(!/adsbygoogle|affiliate|amazon\.com|shareasale/i.test(taxHtml));

const taxLabels = [];
taxHtml.replace(/<label[^>]*>([\s\S]*?)<\/label>/g, function (_, inner) {
  taxLabels.push(inner.replace(/\s+/g, " ").trim());
  return _;
});
assert.ok(taxLabels.length >= 2, "tax brackets page needs field labels");
taxLabels.forEach(function (lab) {
  assert.ok(
    !/^(MFJ|MFS|HoH|HOH|AGI|marginal rate)$/i.test(lab),
    "label must not be jargon-only: " + lab
  );
});
assert.ok(
  taxLabels.some(function (l) {
    return /how do you file this year/i.test(l);
  })
);
assert.ok(
  taxLabels.some(function (l) {
    return /how much is the income/i.test(l);
  })
);
assert.ok(/Just you/.test(taxHtml));
assert.ok(/You and a spouse together/.test(taxHtml));
assert.ok(!/<option[^>]*>Head of household<\/option>/i.test(taxHtml));
assert.ok(/do not add up a tax bill/i.test(taxHtml));

assert.ok(homeHtml.includes("./tax-brackets/"));
assert.ok(
  homeHtml.includes("What tax rate the IRS uses at each income level (2026)")
);
assertNoAds(taxHtml, "tax-brackets");

assert.strictEqual(fsa.YEAR, 2026);
assert.strictEqual(fsa.SALARY_REDUCTION_LIMIT, 3400);
assert.strictEqual(fsa.MAX_CARRYOVER, 680);
assert.ok(fsa.SALARY_REDUCTION_LIMIT !== 3300, "do not use the 2025 FSA cap as 2026");
assert.ok(fsa.MAX_CARRYOVER !== 660, "do not use the 2025 carryover as 2026");
assert.ok(fsa.SALARY_REDUCTION_LIMIT !== 5000, "do not invent a dependent-care FSA dollar");
assert.ok(fsa.MAX_CARRYOVER !== 340, "do not use the transit/parking fringe as FSA carryover");

function fsaLookup(carryover, amount) {
  return fsa.lookup({ carryover: carryover, amount: amount });
}

assert.strictEqual(fsaLookup("yes").limit, 3400);
assert.strictEqual(fsaLookup("no").limit, 3400);
assert.strictEqual(fsaLookup("yes").carryover, 680);
assert.strictEqual(fsaLookup("no").carryover, 0);
assert.strictEqual(fsaLookup("yes").carryoverAllowed, true);
assert.strictEqual(fsaLookup("no").carryoverAllowed, false);
assert.strictEqual(fsaLookup("yes").headline, "$3,400");
assert.strictEqual(fsaLookup("no").headline, "$3,400");
assert.ok(fsaLookup("yes").limit !== 3400 + 680, "do not add leftover to the set-aside cap");
assert.ok(/\$680/.test(fsaLookup("yes").carryoverNote));
assert.ok(/unused money, not extra you can set aside/i.test(fsaLookup("yes").carryoverNote));
assert.ok(/not using the \$680 leftover number/.test(fsaLookup("no").carryoverNote));
assert.ok(!/not using the \$680 leftover number/.test(fsaLookup("yes").carryoverNote));

var fsaUnknown = fsa.lookup({ carryover: "grace-period" });
assert.ok(fsaUnknown.error);
assert.ok(/do not have an official dollar/i.test(fsaUnknown.error));
assert.ok(fsaUnknown.limit == null);
assert.ok(fsaUnknown.carryover == null);

var fsaDepCare = fsa.lookup({ carryover: "dependent-care" });
assert.ok(fsaDepCare.error);
assert.ok(fsaDepCare.limit == null);

var fsaMissing = fsa.lookup({});
assert.ok(fsaMissing.error);
assert.ok(/unused health FSA money carry/i.test(fsaMissing.error));

var fsaUnder = fsaLookup("yes", 3000);
assert.strictEqual(fsaUnder.over, false);
assert.ok(/under this cap/i.test(fsaUnder.comparison));
var fsaAt = fsaLookup("yes", 3400);
assert.strictEqual(fsaAt.over, false);
assert.ok(/at this cap/i.test(fsaAt.comparison));
assert.ok(
  !/under this cap/i.test(fsaAt.comparison),
  "exact $3,400 health FSA cap must not say under"
);
var fsaOver = fsaLookup("no", 3500);
assert.strictEqual(fsaOver.over, true);
assert.ok(/over this cap/i.test(fsaOver.comparison));
assert.strictEqual(fsaLookup("yes", 3400).over, false);
assert.strictEqual(fsaLookup("yes", 3401).over, true);

assert.strictEqual(
  fsa.HUMAN_LINE,
  "Under this dollar, you are within the IRS cap for what you set aside from pay; over it, the IRS does not let that salary reduction go higher for the year."
);
assert.strictEqual(fsaLookup("yes").humanLine, fsa.HUMAN_LINE);
assert.ok(/not tax advice/i.test(fsaLookup("yes").disclaimer));

function fsaCopy(out) {
  return [
    out.headline,
    out.humanLine,
    out.carryoverNote,
    out.comparison,
    out.disclaimer,
    out.limitLabel,
    out.carryoverLabel,
  ].join(" ");
}

[fsaLookup("yes"), fsaLookup("no"), fsaLookup("yes", 3500)].forEach(function (out) {
  var copy = fsaCopy(out);
  assert.ok(!/\$5,000/.test(copy), "do not invent a dependent-care FSA dollar");
  assert.ok(!/\$340/.test(copy), "do not include transit/parking on this page");
  assert.ok(!/QSEHRA/i.test(copy));
  assert.ok(!/§\s*125/i.test(copy), "do not put §125 jargon in result copy");
  assert.ok(/not tax advice/i.test(out.disclaimer));
});

const fsaHtml = fs.readFileSync(path.join(root, "fsa-limits/index.html"), "utf8");
assert.ok(fsaHtml.includes("Last opened 2026-08-27"));
assert.ok(
  fsaHtml.includes(
    "https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill"
  )
);
assert.ok(fsaHtml.includes("https://www.irs.gov/pub/irs-drop/rp-25-32.pdf"));
assert.ok(fsaHtml.includes("$3,400"));
assert.ok(fsaHtml.includes("$680"));
assert.ok(fsaHtml.includes(fsa.HUMAN_LINE));
assert.ok(/out\.humanLine/.test(fsaHtml), "result must render the human line");
assert.ok(/not tax advice/i.test(fsaHtml));
assertLiveGa4(fsaHtml, "fsa-limits");
assert.ok(!/G-[A-Z0-9]+/.test(fsaHtml.replace(/G-3SB1LCNKZK/g, "")));
assert.ok(
  !/\$5,000/.test(fsaHtml),
  "do not invent a dependent-care FSA dollar on the page"
);
assert.ok(
  !/\$340/.test(fsaHtml),
  "do not include transit/parking $340 on this page"
);
assert.ok(!/QSEHRA/i.test(fsaHtml));
assert.ok(!/§\s*125/i.test(fsaHtml), "no §125 jargon on the page");
assert.ok(!/125\(i\)/.test(fsaHtml));
assert.ok(/only use the \$680 leftover number if your plan/i.test(fsaHtml));
assert.ok(/unused money, not extra you can set aside/i.test(fsaHtml));
assert.ok(/do not look up dependent-care FSA, transit, parking/i.test(fsaHtml));
assert.ok(!/adsbygoogle|affiliate|amazon\.com|shareasale/i.test(fsaHtml));

const fsaLabels = [];
fsaHtml.replace(/<label[^>]*>([\s\S]*?)<\/label>/g, function (_, inner) {
  fsaLabels.push(inner.replace(/\s+/g, " ").trim());
  return _;
});
assert.ok(fsaLabels.length >= 2, "FSA page needs field labels");
fsaLabels.forEach(function (lab) {
  assert.ok(
    !/^(§125\(i\)|125\(i\)|cafeteria plan|salary reduction)$/i.test(lab),
    "label must not be jargon-only: " + lab
  );
  assert.ok(!/§/.test(lab), "label must not use section-symbol jargon: " + lab);
});
assert.ok(
  fsaLabels.some(function (l) {
    return /unused health FSA money carry to next year/i.test(l);
  })
);
assert.ok(
  fsaLabels.some(function (l) {
    return /set aside from pay this year/i.test(l);
  })
);

assert.ok(homeHtml.includes("./fsa-limits/"));
assert.ok(
  homeHtml.includes("How much you can put in a health FSA this year (2026)")
);
assertNoAds(fsaHtml, "fsa-limits");

// Issue #24: #form-error must look like an error (.err), not a footnote (.disclaimer).
function formErrorTag(html) {
  return (
    html.match(/<p\b[^>]*\bid=["']form-error["'][^>]*>/i) ||
    html.match(/<p\b[^>]*id=["']form-error["'][^>]*>/i) ||
    []
  )[0];
}

function classList(tag) {
  var m = tag && tag.match(/\bclass=["']([^"']*)["']/i);
  return m ? m[1].trim().split(/\s+/).filter(Boolean) : [];
}

function calculatorHtmlPaths() {
  return fs
    .readdirSync(root)
    .filter(function (name) {
      var dir = path.join(root, name);
      return (
        fs.statSync(dir).isDirectory() &&
        fs.existsSync(path.join(dir, "calculator.js")) &&
        fs.existsSync(path.join(dir, "index.html"))
      );
    })
    .map(function (name) {
      return path.join(name, "index.html");
    });
}

var formErrorPages = calculatorHtmlPaths().filter(function (rel) {
  var html = fs.readFileSync(path.join(root, rel), "utf8");
  return /id=["']form-error["']/.test(html);
});
assert.ok(
  formErrorPages.length >= 10,
  "expected every current calculator to have #form-error"
);
formErrorPages.forEach(function (rel) {
  var html = fs.readFileSync(path.join(root, rel), "utf8");
  var tag = formErrorTag(html);
  assert.ok(tag, rel + " must have a <p id=\"form-error\">");
  var classes = classList(tag);
  assert.ok(
    classes.indexOf("err") !== -1,
    rel + " #form-error must use .err, got class=\"" + classes.join(" ") + "\""
  );
  assert.ok(
    classes.indexOf("disclaimer") === -1,
    rel + " #form-error must not use .disclaimer"
  );
});

var stylesCss = fs.readFileSync(path.join(root, "styles.css"), "utf8");
assert.ok(
  /\.err\s*\{[^}]*color:\s*var\(--danger\)/.test(stylesCss),
  ".err must keep the danger text color"
);

// Cheap paint empty-submit: same path as the page script (calc → paint #form-error).
var paintEmptySubmit = paint.calc({
  length: "",
  width: "",
  height: "",
  doors: "0",
  windows: "0",
  coats: "2",
  coverage: "350",
});
assert.ok(paintEmptySubmit.error);
assert.ok(/Enter length/.test(paintEmptySubmit.error));
var paintFormError = {
  hidden: true,
  textContent: "",
  className: classList(formErrorTag(paintHtml)).join(" "),
};
paintFormError.hidden = true;
if (paintEmptySubmit.error) {
  paintFormError.hidden = false;
  paintFormError.textContent = paintEmptySubmit.error;
}
assert.strictEqual(paintFormError.hidden, false);
assert.strictEqual(
  paintFormError.textContent,
  "Enter length, width, height, coats, and coverage greater than zero."
);
assert.ok(
  /\berr\b/.test(paintFormError.className),
  "empty paint submit must show #form-error as .err"
);
assert.ok(
  !/\bdisclaimer\b/.test(paintFormError.className),
  "empty paint submit must not paint #form-error as .disclaimer"
);

// Issue #32: money-page <title> leads with the searched phrase; <h1> stays put.
function htmlTitle(html) {
  var m = html.match(/<title>([\s\S]*?)<\/title>/i);
  assert.ok(m, "page must have a <title>");
  return m[1].replace(/\s+/g, " ").trim();
}

function htmlH1(html) {
  var m = html.match(/<h1>[\s\S]*?<\/h1>/);
  assert.ok(m, "page must have an <h1>");
  return m[0];
}

[
  {
    file: "hsa-limits/index.html",
    html: hsaHtml,
    phrase: "hsa limit",
    h1: "<h1>How much you can put in an HSA this year (2026)</h1>",
  },
  {
    file: "mileage/index.html",
    html: mileHtml,
    phrase: "mileage rate",
    h1: "<h1>How much the IRS says one mile is worth (2026)</h1>",
  },
  {
    file: "retirement-limits/index.html",
    html: retHtml,
    phrase: "401(k) limit",
    h1: "<h1>How much you can put in a 401(k) or IRA this year (2026)</h1>",
  },
  {
    file: "standard-deduction/index.html",
    html: stdHtml,
    phrase: "standard deduction",
    h1: "<h1>How much the IRS lets most people subtract before tax (2026)</h1>",
  },
  {
    file: "mortgage-limit/index.html",
    html: loanHtml,
    phrase: "conforming loan limit",
    h1: "<h1>How big a normal mortgage can be (2026)</h1>",
  },
].forEach(function (page) {
  var title = htmlTitle(page.html);
  assert.ok(
    title.toLowerCase().indexOf(page.phrase) !== -1,
    page.file + " <title> must contain \"" + page.phrase + "\": " + title
  );
  assert.strictEqual(
    htmlH1(page.html),
    page.h1,
    page.file + " <h1> must stay byte-identical"
  );
});

// Issue #39: mortgage-limit SERP title and meta stay exact, short, and singular.
// Reverting either string fails this check.
var LOAN_SERP_TITLE =
  "2026 conforming loan limit by county (FHFA) · Sourced Calc";
var LOAN_SERP_DESCRIPTION =
  "Look up your county's 2026 conforming loan limit from the official FHFA file: $832,750 in most counties, up to $1,249,125 in high-cost areas.";
var LOAN_SERP_TITLE_BEFORE =
  "2026 conforming loan limit — how big a normal mortgage can be · Sourced Calc";
var LOAN_SERP_DESCRIPTION_BEFORE =
  "Look up the official 2026 county cap for a normal mortgage. Under that dollar, a normal mortgage. Over it, a harder loan, usually a worse rate. Estimate, not a quote.";

function htmlTitleTags(html) {
  return html.match(/<title\b[^>]*>[\s\S]*?<\/title>/gi) || [];
}

function htmlMetaDescriptionTags(html) {
  return (html.match(/<meta\b[^>]*>/gi) || []).filter(function (tag) {
    return /\bname\s*=\s*["']description["']/i.test(tag);
  });
}

function metaContentAttr(tag) {
  var m = tag.match(/\bcontent\s*=\s*"([^"]*)"/i);
  if (!m) m = tag.match(/\bcontent\s*=\s*'([^']*)'/i);
  assert.ok(m, "meta description is missing a content attribute");
  return m[1].replace(/\s+/g, " ").trim();
}

var loanBuiltHtml = fs.readFileSync(
  path.join(root, "mortgage-limit/index.html"),
  "utf8"
);
var loanTitleTags = htmlTitleTags(loanBuiltHtml);
assert.strictEqual(
  loanTitleTags.length,
  1,
  "mortgage-limit must have exactly one <title>, found " + loanTitleTags.length
);
var loanSerpTitle = htmlTitle(loanBuiltHtml);
assert.strictEqual(loanSerpTitle, LOAN_SERP_TITLE);
assert.notStrictEqual(loanSerpTitle, LOAN_SERP_TITLE_BEFORE);
assert.ok(
  loanSerpTitle.length <= 60,
  "mortgage-limit <title> is " + loanSerpTitle.length + " characters; max 60"
);
var loanDescTags = htmlMetaDescriptionTags(loanBuiltHtml);
assert.strictEqual(
  loanDescTags.length,
  1,
  "mortgage-limit must have exactly one meta description, found " +
    loanDescTags.length
);
var loanSerpDescription = metaContentAttr(loanDescTags[0]);
assert.strictEqual(loanSerpDescription, LOAN_SERP_DESCRIPTION);
assert.notStrictEqual(loanSerpDescription, LOAN_SERP_DESCRIPTION_BEFORE);
assert.ok(
  loanSerpDescription.length <= 155,
  "mortgage-limit meta description is " +
    loanSerpDescription.length +
    " characters; max 155"
);

// Issue #25: muted text on page gray must meet WCAG AA (4.5:1).
// Today's tokens --muted #6b7280 on --bg #f3f4f6 are 4.39:1 and fail.
function normalizeHex(hex) {
  hex = String(hex).trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    return (
      "#" +
      hex[1] +
      hex[1] +
      hex[2] +
      hex[2] +
      hex[3] +
      hex[3]
    );
  }
  assert.ok(/^#[0-9a-f]{6}$/.test(hex), "expected #rrggbb, got " + hex);
  return hex;
}

function hexToRgb(hex) {
  hex = normalizeHex(hex).slice(1);
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function srgbChannel(c) {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  var rgb = hexToRgb(hex);
  return (
    0.2126 * srgbChannel(rgb[0]) +
    0.7152 * srgbChannel(rgb[1]) +
    0.0722 * srgbChannel(rgb[2])
  );
}

function contrastRatio(fg, bg) {
  var a = relativeLuminance(fg);
  var b = relativeLuminance(bg);
  var lighter = Math.max(a, b);
  var darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function cssCustomPropHex(css, name) {
  var m = css.match(new RegExp("--" + name + "\\s*:\\s*(#[0-9a-fA-F]{3,8})"));
  assert.ok(m, "styles.css must define --" + name + " as a hex color");
  return normalizeHex(m[1]);
}

function cssRuleDecl(css, selector, prop) {
  var escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var block = css.match(new RegExp(escaped + "\\s*\\{([^}]+)\\}"));
  assert.ok(block, selector + " rule missing");
  var m = block[1].match(new RegExp("(?:^|;)\\s*" + prop + "\\s*:\\s*([^;]+);"));
  assert.ok(m, selector + " must set " + prop);
  return m[1].trim();
}

function resolveCssColor(value, css) {
  var varMatch = value.match(/^var\(\s*--([a-z0-9-]+)\s*\)$/i);
  if (varMatch) return cssCustomPropHex(css, varMatch[1]);
  if (/^#/.test(value)) return normalizeHex(value);
  assert.fail("unresolved color " + value);
}

assert.ok(
  contrastRatio("#6b7280", "#f3f4f6") < 4.5,
  "fixture: today's #6b7280 on #f3f4f6 must stay a known AA fail (4.39:1)"
);
assert.ok(
  Math.abs(contrastRatio("#6b7280", "#f3f4f6") - 4.39) < 0.01,
  "fixture: today's muted-on-gray ratio is 4.39:1"
);

var pageBg = resolveCssColor(cssRuleDecl(stylesCss, "body", "background"), stylesCss);
var ledeFg = resolveCssColor(cssRuleDecl(stylesCss, ".lede", "color"), stylesCss);
var footerFg = resolveCssColor(
  cssRuleDecl(stylesCss, ".site-footer", "color"),
  stylesCss
);
var ledeContrast = contrastRatio(ledeFg, pageBg);
var footerContrast = contrastRatio(footerFg, pageBg);

assert.ok(
  ledeContrast >= 4.5,
  ".lede on page background is " +
    ledeContrast.toFixed(2) +
    ":1 (" +
    ledeFg +
    " on " +
    pageBg +
    "); WCAG AA needs ≥4.5:1"
);
assert.ok(
  footerContrast >= 4.5,
  ".site-footer on page background is " +
    footerContrast.toFixed(2) +
    ":1 (" +
    footerFg +
    " on " +
    pageBg +
    "); WCAG AA needs ≥4.5:1"
);
assert.ok(
  !(ledeFg === "#6b7280" && pageBg === "#f3f4f6"),
  ".lede must not keep today's failing #6b7280 on #f3f4f6"
);
assert.ok(
  !(footerFg === "#6b7280" && pageBg === "#f3f4f6"),
  ".site-footer must not keep today's failing #6b7280 on #f3f4f6"
);

// Issue #22: browsers request /favicon.ico and Apple touch icons.
// Every HTML page must link those icons, and each referenced file must exist.
function walkHtml(dir, acc) {
  fs.readdirSync(dir).forEach(function (name) {
    if (name === "node_modules" || name === ".git" || name === ".wrangler") return;
    var full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkHtml(full, acc);
    else if (name.slice(-5).toLowerCase() === ".html") acc.push(full);
  });
  return acc;
}

function linkAttr(tag, name) {
  var m = tag.match(
    new RegExp("\\b" + name + "\\s*=\\s*[\"']([^\"']*)[\"']", "i")
  );
  return m ? m[1] : "";
}

function relTokens(tag) {
  return linkAttr(tag, "rel")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function isIconRel(tokens) {
  return (
    tokens.indexOf("icon") !== -1 || tokens.indexOf("apple-touch-icon") !== -1
  );
}

function resolveSiteHref(fromFile, href) {
  var page = path.relative(root, fromFile);
  assert.ok(href, page + " icon link is missing href");
  assert.ok(
    href.indexOf("//") !== 0 && !/^[a-z][a-z0-9+.-]*:/i.test(href),
    page + " icon href must be a local file: " + href
  );
  var full =
    href.charAt(0) === "/"
      ? path.join(root, href.replace(/^\/+/, ""))
      : path.resolve(path.dirname(fromFile), href);
  var rel = path.relative(root, full);
  assert.ok(
    rel &&
      rel !== ".." &&
      rel.indexOf(".." + path.sep) !== 0 &&
      !path.isAbsolute(rel),
    page + " icon href escapes the site: " + href
  );
  return full;
}

function assertImageBytes(file) {
  var rel = path.relative(root, file);
  assert.ok(fs.existsSync(file), "referenced icon file is missing: " + rel);
  var buf = fs.readFileSync(file);
  assert.ok(buf.length > 0, "referenced icon file is empty: " + rel);
  var ext = path.extname(file).toLowerCase();
  if (ext === ".png") {
    assert.ok(
      buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG",
      rel + " must be a PNG image"
    );
  } else if (ext === ".ico") {
    assert.strictEqual(buf.readUInt16LE(0), 0, rel + " ICO reserved field");
    assert.strictEqual(buf.readUInt16LE(2), 1, rel + " must be an ICO image");
    assert.ok(buf.readUInt16LE(4) >= 1, rel + " ICO must contain an image");
  } else if (ext === ".svg") {
    assert.ok(/<svg[\s>]/i.test(buf.toString("utf8")), rel + " must be an SVG image");
  } else {
    assert.fail(rel + " is not an image favicon (.ico, .png, or .svg)");
  }
}

var faviconHtmlPages = walkHtml(root, []);
var htmlRels = faviconHtmlPages.map(function (file) {
  return path.relative(root, file);
});
assert.ok(htmlRels.indexOf("index.html") !== -1, "home page must be checked");
assert.ok(htmlRels.indexOf("404.html") !== -1, "404 page must be checked");
calculatorHtmlPaths().forEach(function (rel) {
  assert.ok(htmlRels.indexOf(rel) !== -1, "calculator page must be checked: " + rel);
});

faviconHtmlPages.forEach(function (file) {
  var relPage = path.relative(root, file);
  var html = fs.readFileSync(file, "utf8");
  var tags = html.match(/<link\b[^>]*>/gi) || [];
  var iconLinks = tags.filter(function (tag) {
    return isIconRel(relTokens(tag));
  });
  assert.ok(iconLinks.length > 0, relPage + " must reference a favicon");
  var sawIco = false;
  var sawApple = false;
  var sawApple180 = false;
  iconLinks.forEach(function (tag) {
    var full = resolveSiteHref(file, linkAttr(tag, "href"));
    assertImageBytes(full);
    var base = path.basename(full);
    var tokens = relTokens(tag);
    if (tokens.indexOf("icon") !== -1 && base === "favicon.ico") sawIco = true;
    if (tokens.indexOf("apple-touch-icon") !== -1 && base === "apple-touch-icon.png") {
      sawApple = true;
    }
    if (
      tokens.indexOf("apple-touch-icon") !== -1 &&
      base === "apple-touch-icon-180x180.png"
    ) {
      sawApple180 = true;
    }
  });
  assert.ok(sawIco, relPage + " must link favicon.ico");
  assert.ok(sawApple, relPage + " must link apple-touch-icon.png");
  assert.ok(sawApple180, relPage + " must link apple-touch-icon-180x180.png");
});

["favicon.ico", "apple-touch-icon.png", "apple-touch-icon-180x180.png"].forEach(
  function (name) {
    assertImageBytes(path.join(root, name));
  }
);

// Issue #41: /fsa-limits/ and /tax-brackets/ SERP title and meta stay exact.
// Reverting either string fails this check. H1 and canonical stay byte-identical.
// Self-contained so a parallel lede check (#42) can land beside it.
(function () {
  function titleTags(html) {
    return html.match(/<title\b[^>]*>[\s\S]*?<\/title>/gi) || [];
  }

  function titleText(html) {
    var tags = titleTags(html);
    assert.strictEqual(tags.length, 1, "expected exactly one <title>");
    var m = tags[0].match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    assert.ok(m, "page must have a <title>");
    return m[1].replace(/\s+/g, " ").trim();
  }

  function metaDescriptionTags(html) {
    return (html.match(/<meta\b[^>]*>/gi) || []).filter(function (tag) {
      return /\bname\s*=\s*["']description["']/i.test(tag);
    });
  }

  function metaContentAttr(tag) {
    var m = tag.match(/\bcontent\s*=\s*"([^"]*)"/i);
    if (!m) m = tag.match(/\bcontent\s*=\s*'([^']*)'/i);
    assert.ok(m, "meta description is missing a content attribute");
    return m[1].replace(/\s+/g, " ").trim();
  }

  function h1Tag(html) {
    var tags = html.match(/<h1>[\s\S]*?<\/h1>/g) || [];
    assert.strictEqual(tags.length, 1, "expected exactly one <h1>");
    return tags[0];
  }

  function canonicalHref(html) {
    var tags = (html.match(/<link\b[^>]*>/gi) || []).filter(function (tag) {
      return /\brel\s*=\s*["']canonical["']/i.test(tag);
    });
    assert.strictEqual(tags.length, 1, "expected exactly one canonical link");
    var m = tags[0].match(/\bhref\s*=\s*"([^"]*)"/i);
    if (!m) m = tags[0].match(/\bhref\s*=\s*'([^']*)'/i);
    assert.ok(m, "canonical link is missing href");
    return m[1];
  }

  [
    {
      file: "fsa-limits/index.html",
      title: "2026 health FSA limit: $3,400 (IRS) \u00B7 Sourced Calc",
      titleLength: 50,
      titleBefore:
        "How much you can put in a health FSA this year (2026) \u00B7 Sourced Calc",
      description:
        "Look up the official 2026 health FSA cap: $3,400 set aside from pay. If your plan allows it, up to $680 of unused money can carry over. Not tax advice.",
      descriptionLength: 151,
      descriptionBefore:
        "Look up the official 2026 health FSA cap for what you set aside from pay, and the leftover max if your plan lets unused money carry to next year. Not tax advice.",
      phrase: "fsa limit",
      h1: "<h1>How much you can put in a health FSA this year (2026)</h1>",
      canonical: "https://sourcedcalc.com/fsa-limits/",
    },
    {
      file: "tax-brackets/index.html",
      title: "2026 federal income tax brackets (IRS) \u00B7 Sourced Calc",
      titleLength: 53,
      titleBefore:
        "What tax rate the IRS uses at each income level (2026) \u00B7 Sourced Calc",
      description:
        "Look up the official 2026 IRS tax rate for your income, from 10% to 37%, for just you or you and a spouse together. Not tax advice.",
      descriptionLength: 131,
      descriptionBefore:
        "Look up the official 2026 IRS income-tax rate for just you or you and a spouse together. Official figure lookup, not tax advice.",
      phrase: "tax brackets",
      h1: "<h1>What tax rate the IRS uses at each income level (2026)</h1>",
      canonical: "https://sourcedcalc.com/tax-brackets/",
    },
  ].forEach(function (page) {
    var html = fs.readFileSync(path.join(root, page.file), "utf8");
    var titles = titleTags(html);
    assert.strictEqual(
      titles.length,
      1,
      page.file + " must have exactly one <title>, found " + titles.length
    );
    var title = titleText(html);
    assert.strictEqual(page.title.length, page.titleLength);
    assert.strictEqual(title, page.title, page.file + " <title>");
    assert.notStrictEqual(title, page.titleBefore);
    assert.strictEqual(
      title.charCodeAt(title.indexOf("\u00B7")),
      0x00b7,
      page.file + " title middle dot must be U+00B7"
    );
    assert.ok(
      title.length <= 60,
      page.file + " <title> is " + title.length + " characters; max 60"
    );
    assert.ok(
      title.toLowerCase().indexOf(page.phrase) !== -1,
      page.file + ' <title> must contain "' + page.phrase + '": ' + title
    );

    var descTags = metaDescriptionTags(html);
    assert.strictEqual(
      descTags.length,
      1,
      page.file +
        " must have exactly one meta description, found " +
        descTags.length
    );
    var description = metaContentAttr(descTags[0]);
    assert.strictEqual(page.description.length, page.descriptionLength);
    assert.strictEqual(
      description,
      page.description,
      page.file + " meta description"
    );
    assert.notStrictEqual(description, page.descriptionBefore);
    assert.ok(
      description.length <= 155,
      page.file +
        " meta description is " +
        description.length +
        " characters; max 155"
    );

    assert.strictEqual(
      h1Tag(html),
      page.h1,
      page.file + " <h1> must stay byte-identical"
    );
    assert.strictEqual(
      canonicalHref(html),
      page.canonical,
      page.file + " canonical URL must stay unchanged"
    );
  });
})();

// Issue #42: official 2026 dollars in the .lede, above the form.
// Self-contained so a parallel title/meta check can land beside this block.
(function () {
  function h1Tag(html) {
    var m = html.match(/<h1>[\s\S]*?<\/h1>/);
    assert.ok(m, "page must have an <h1>");
    return m[0];
  }

  function ledeTextBeforeForm(html, page) {
    var formAt = html.indexOf("<form");
    assert.ok(formAt !== -1, page + " must include <form");
    var beforeForm = html.slice(0, formAt);
    var m = beforeForm.match(/<p class="lede">([\s\S]*?)<\/p>/);
    assert.ok(m, page + " .lede must appear in the HTML before <form");
    return m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  var hsaPage = fs.readFileSync(
    path.join(root, "hsa-limits/index.html"),
    "utf8"
  );
  assert.strictEqual(
    h1Tag(hsaPage),
    "<h1>How much you can put in an HSA this year (2026)</h1>",
    "hsa-limits <h1> must stay byte-identical"
  );
  var hsaSelf = hsa.formatDollar(hsa.SELF_BASE);
  var hsaFamily = hsa.formatDollar(hsa.FAMILY_BASE);
  var hsaExtra = hsa.formatDollar(hsa.AGE_55_EXTRA);
  var hsaLede = ledeTextBeforeForm(hsaPage, "hsa-limits");
  var hsaSentence =
    "For " +
    hsa.YEAR +
    " the IRS cap is " +
    hsaSelf +
    " if the plan covers just you, or " +
    hsaFamily +
    " for you and family. If you are 55 or older, add " +
    hsaExtra +
    ".";
  assert.ok(
    hsaLede.indexOf(hsaSelf) !== -1 &&
      hsaLede.indexOf(hsaFamily) !== -1 &&
      hsaLede.indexOf(hsaExtra) !== -1,
    "hsa-limits .lede before <form must contain caps from calculator.js via formatDollar: " +
      [hsaSelf, hsaFamily, hsaExtra].join(", ") +
      " — lede: " +
      hsaLede
  );
  assert.strictEqual(
    hsaLede.indexOf(hsaSentence),
    0,
    "hsa-limits .lede must start with the official cap sentence. Got: " + hsaLede
  );

  assert.deepStrictEqual(hsa.lookup({ coverage: "self", age55: "no" }), {
    year: 2026,
    coverage: "self",
    coverageLabel: "Just you",
    age55: false,
    base: 4400,
    extra: 0,
    limit: 4400,
    limitLabel: "$4,400",
    minDeductible: 1700,
    maxOop: 8500,
    extraNote: null,
    planNote:
      "To use an HSA, the plan has to have a yearly deductible of at least $1,700, and yearly out-of-pocket costs (not counting premiums) cannot go past $8,500.",
    humanLine: "How much you can put in an HSA this year",
    headline: "$4,400",
    disclaimer: "This is not tax advice.",
  });
  assert.deepStrictEqual(hsa.lookup({ coverage: "self", age55: "yes" }), {
    year: 2026,
    coverage: "self",
    coverageLabel: "Just you",
    age55: true,
    base: 4400,
    extra: 1000,
    limit: 5400,
    limitLabel: "$5,400",
    minDeductible: 1700,
    maxOop: 8500,
    extraNote:
      "Extra $1,000 because you are 55 or older at year-end. That extra is from IRS Publication 969.",
    planNote:
      "To use an HSA, the plan has to have a yearly deductible of at least $1,700, and yearly out-of-pocket costs (not counting premiums) cannot go past $8,500.",
    humanLine: "How much you can put in an HSA this year",
    headline: "$5,400",
    disclaimer: "This is not tax advice.",
  });
  assert.deepStrictEqual(hsa.lookup({ coverage: "family", age55: "no" }), {
    year: 2026,
    coverage: "family",
    coverageLabel: "You and family",
    age55: false,
    base: 8750,
    extra: 0,
    limit: 8750,
    limitLabel: "$8,750",
    minDeductible: 3400,
    maxOop: 17000,
    extraNote: null,
    planNote:
      "To use an HSA, the plan has to have a yearly deductible of at least $3,400, and yearly out-of-pocket costs (not counting premiums) cannot go past $17,000.",
    humanLine: "How much you can put in an HSA this year",
    headline: "$8,750",
    disclaimer: "This is not tax advice.",
  });
  assert.deepStrictEqual(hsa.lookup({ coverage: "family", age55: "yes" }), {
    year: 2026,
    coverage: "family",
    coverageLabel: "You and family",
    age55: true,
    base: 8750,
    extra: 1000,
    limit: 9750,
    limitLabel: "$9,750",
    minDeductible: 3400,
    maxOop: 17000,
    extraNote:
      "Extra $1,000 because you are 55 or older at year-end. That extra is from IRS Publication 969.",
    planNote:
      "To use an HSA, the plan has to have a yearly deductible of at least $3,400, and yearly out-of-pocket costs (not counting premiums) cannot go past $17,000.",
    humanLine: "How much you can put in an HSA this year",
    headline: "$9,750",
    disclaimer: "This is not tax advice.",
  });

  var fsaPage = fs.readFileSync(
    path.join(root, "fsa-limits/index.html"),
    "utf8"
  );
  assert.strictEqual(
    h1Tag(fsaPage),
    "<h1>How much you can put in a health FSA this year (2026)</h1>",
    "fsa-limits <h1> must stay byte-identical"
  );
  var fsaCap = fsa.formatDollar(fsa.SALARY_REDUCTION_LIMIT);
  var fsaCarry = fsa.formatDollar(fsa.MAX_CARRYOVER);
  var fsaLede = ledeTextBeforeForm(fsaPage, "fsa-limits");
  var fsaSentence =
    "For " +
    fsa.YEAR +
    " the IRS cap is " +
    fsaCap +
    " set aside from pay. If your plan lets unused money carry to next year, up to " +
    fsaCarry +
    " of it can carry.";
  assert.ok(
    fsaLede.indexOf(fsaCap) !== -1 && fsaLede.indexOf(fsaCarry) !== -1,
    "fsa-limits .lede before <form must contain caps from calculator.js via formatDollar: " +
      [fsaCap, fsaCarry].join(", ") +
      " — lede: " +
      fsaLede
  );
  assert.strictEqual(
    fsaLede.indexOf(fsaSentence),
    0,
    "fsa-limits .lede must start with the official cap sentence. Got: " + fsaLede
  );
  assert.ok(
    !new RegExp(
      fsaCarry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "\\s+extra|extra\\s+" +
        fsaCarry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "|plus\\s+" +
        fsaCarry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "|on top of",
      "i"
    ).test(fsaLede),
    "fsa-limits lede must not describe the carryover as extra on top of the cap"
  );

  assert.deepStrictEqual(fsa.lookup({ carryover: "yes" }), {
    year: 2026,
    carryoverAllowed: true,
    carryover: 680,
    carryoverLabel: "$680",
    carryoverNote:
      "Your plan lets unused money carry to next year. The official max leftover is $680. That leftover is unused money, not extra you can set aside from this year's pay.",
    limit: 3400,
    limitLabel: "$3,400",
    amount: null,
    over: null,
    comparison: null,
    humanLine:
      "Under this dollar, you are within the IRS cap for what you set aside from pay; over it, the IRS does not let that salary reduction go higher for the year.",
    headline: "$3,400",
    disclaimer: "This is an official IRS figure lookup, not tax advice.",
  });
  assert.deepStrictEqual(fsa.lookup({ carryover: "no" }), {
    year: 2026,
    carryoverAllowed: false,
    carryover: 0,
    carryoverLabel: null,
    carryoverNote:
      "Your plan does not let unused money carry to next year, so we are not using the $680 leftover number.",
    limit: 3400,
    limitLabel: "$3,400",
    amount: null,
    over: null,
    comparison: null,
    humanLine:
      "Under this dollar, you are within the IRS cap for what you set aside from pay; over it, the IRS does not let that salary reduction go higher for the year.",
    headline: "$3,400",
    disclaimer: "This is an official IRS figure lookup, not tax advice.",
  });
  assert.strictEqual(fsa.lookup({ carryover: "yes" }).limit, 3400);
  assert.ok(
    fsa.lookup({ carryover: "yes" }).limit !== 3400 + 680,
    "lookup must not add the carryover on top of the set-aside cap"
  );
})();

// Issue #45: every money-page <title> from sitemap.xml is <= 60 characters.
// No exceptions. These four titles are exact strings.
// Money pages are sitemap <loc>s other than the home page and the three
// non-dollar tools, so a new sitemap URL is covered automatically.
(function () {
  var TITLE_MAX = 60;
  var HSA_TITLE =
    "2026 HSA limit: $4,400 / $8,750 (IRS) \u00B7 Sourced Calc";
  var HSA_TITLE_BEFORE =
    "2026 HSA contribution limits \u2014 how much you can put in an HSA this year \u00B7 Sourced Calc";
  var HSA_DESCRIPTION =
    "Look up the official 2026 yearly cap for a health savings account. Just you or you and family, plus $1,000 if you are 55 or older. Not tax advice.";
  var NOT_MONEY = {
    "https://sourcedcalc.com/": true,
    "https://sourcedcalc.com/paint-coverage/": true,
    "https://sourcedcalc.com/concrete-bags/": true,
    "https://sourcedcalc.com/wa-heat-pump-rebate/": true,
  };
  var EXACT_TITLES = {
    "hsa-limits/index.html": HSA_TITLE,
    "mileage/index.html":
      "2026 IRS mileage rate by trip date \u00B7 Sourced Calc",
    "retirement-limits/index.html":
      "2026 401(k) limit $24,500 \u00B7 IRA $7,500 (IRS) \u00B7 Sourced Calc",
    "standard-deduction/index.html":
      "2026 standard deduction: $16,100 / $32,200 \u00B7 Sourced Calc",
  };

  function titleTags(html) {
    return html.match(/<title\b[^>]*>[\s\S]*?<\/title>/gi) || [];
  }

  function titleText(html) {
    var tags = titleTags(html);
    assert.strictEqual(tags.length, 1, "expected exactly one <title>");
    var m = tags[0].match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    assert.ok(m, "page must have a <title>");
    return m[1].replace(/\s+/g, " ").trim();
  }

  function metaDescription(html) {
    var tags = (html.match(/<meta\b[^>]*>/gi) || []).filter(function (tag) {
      return /\bname\s*=\s*["']description["']/i.test(tag);
    });
    assert.strictEqual(tags.length, 1, "expected exactly one meta description");
    var m = tags[0].match(/\bcontent\s*=\s*"([^"]*)"/i);
    if (!m) m = tags[0].match(/\bcontent\s*=\s*'([^']*)'/i);
    assert.ok(m, "meta description is missing a content attribute");
    return m[1].replace(/\s+/g, " ").trim();
  }

  function h1Tag(html) {
    var tags = html.match(/<h1>[\s\S]*?<\/h1>/g) || [];
    assert.strictEqual(tags.length, 1, "expected exactly one <h1>");
    return tags[0];
  }

  function canonicalHref(html) {
    var tags = (html.match(/<link\b[^>]*>/gi) || []).filter(function (tag) {
      return /\brel\s*=\s*["']canonical["']/i.test(tag);
    });
    assert.strictEqual(tags.length, 1, "expected exactly one canonical link");
    var m = tags[0].match(/\bhref\s*=\s*"([^"]*)"/i);
    if (!m) m = tags[0].match(/\bhref\s*=\s*'([^']*)'/i);
    assert.ok(m, "canonical link is missing href");
    return m[1];
  }

  function fileForLoc(loc) {
    var pathPart = loc.replace("https://sourcedcalc.com", "");
    if (pathPart === "/") return "index.html";
    return pathPart.replace(/^\//, "").replace(/\/$/, "") + "/index.html";
  }

  var locs = [];
  sitemap.replace(/<loc>([^<]+)<\/loc>/g, function (_, loc) {
    locs.push(loc);
    return _;
  });
  var moneyLocs = locs.filter(function (loc) {
    return !NOT_MONEY[loc];
  });
  [
    "https://sourcedcalc.com/mortgage-limit/",
    "https://sourcedcalc.com/retirement-limits/",
    "https://sourcedcalc.com/mileage/",
    "https://sourcedcalc.com/hsa-limits/",
    "https://sourcedcalc.com/standard-deduction/",
    "https://sourcedcalc.com/tax-brackets/",
    "https://sourcedcalc.com/fsa-limits/",
  ].forEach(function (loc) {
    assert.ok(
      moneyLocs.indexOf(loc) !== -1,
      "money pages from sitemap must include " + loc
    );
  });
  assert.ok(
    moneyLocs.length >= 7,
    "expected at least the 7 money pages, found " + moneyLocs.length
  );

  var seenMoneyFiles = [];
  moneyLocs.forEach(function (loc) {
    var file = fileForLoc(loc);
    seenMoneyFiles.push(file);
    var html = fs.readFileSync(path.join(root, file), "utf8");
    var title = titleText(html);
    assert.ok(
      title.length <= TITLE_MAX,
      file + " <title> is " + title.length + " characters; max " + TITLE_MAX
    );
    if (Object.prototype.hasOwnProperty.call(EXACT_TITLES, file)) {
      assert.strictEqual(title, EXACT_TITLES[file], file + " <title>");
    }
    assert.ok(
      !/property\s*=\s*["']og:title["']/i.test(html) &&
        !/name\s*=\s*["']twitter:title["']/i.test(html),
      file + " must not have og:title or twitter:title"
    );
  });
  Object.keys(EXACT_TITLES).forEach(function (file) {
    assert.ok(
      seenMoneyFiles.indexOf(file) !== -1,
      "money pages from sitemap must include " + file
    );
  });

  var hsaPage = fs.readFileSync(
    path.join(root, "hsa-limits/index.html"),
    "utf8"
  );
  var hsaTitle = titleText(hsaPage);
  assert.strictEqual(HSA_TITLE.length, 52);
  assert.strictEqual(hsaTitle, HSA_TITLE, "hsa-limits <title>");
  assert.notStrictEqual(hsaTitle, HSA_TITLE_BEFORE);
  assert.strictEqual(
    hsaTitle.charCodeAt(hsaTitle.indexOf("\u00B7")),
    0x00b7,
    "hsa-limits title middle dot must be U+00B7"
  );
  assert.ok(
    hsaTitle.length <= TITLE_MAX,
    "hsa-limits <title> is " + hsaTitle.length + " characters; max " + TITLE_MAX
  );
  assert.strictEqual(HSA_DESCRIPTION.length, 146);
  assert.strictEqual(
    metaDescription(hsaPage),
    HSA_DESCRIPTION,
    "hsa-limits meta description must stay unchanged"
  );
  assert.strictEqual(
    h1Tag(hsaPage),
    "<h1>How much you can put in an HSA this year (2026)</h1>",
    "hsa-limits <h1> must stay byte-identical"
  );
  assert.strictEqual(
    canonicalHref(hsaPage),
    "https://sourcedcalc.com/hsa-limits/",
    "hsa-limits canonical URL must stay unchanged"
  );
})();

// Issue #46: shared footer. Existing links stay, including Home.
// Missing calculators are appended. The current page is not a normal link.
// Title text is whatever the file already contains (Issue #45 owns the
// exact money-page strings and the 60-character cap).
(function () {
  var HOME_LINK = { href: "../index.html", label: "Home" };
  var EXPECTED = {
    "mileage/index.html": [
      HOME_LINK,
      { href: "../wa-heat-pump-rebate/", label: "Heat pump rebate" },
      { href: "../paint-coverage/", label: "Paint" },
      { href: "../concrete-bags/", label: "Concrete" },
      { href: "../mortgage-limit/", label: "Mortgage cap" },
      { href: "../retirement-limits/", label: "401(k) / IRA" },
      { href: "../hsa-limits/", label: "HSA" },
      { href: "../standard-deduction/", label: "Standard deduction" },
      { href: "../tax-brackets/", label: "Tax rates" },
      { href: "../fsa-limits/", label: "Health FSA" },
    ],
    "fsa-limits/index.html": [
      HOME_LINK,
      { href: "../wa-heat-pump-rebate/", label: "Heat pump rebate" },
      { href: "../paint-coverage/", label: "Paint" },
      { href: "../concrete-bags/", label: "Concrete" },
      { href: "../mortgage-limit/", label: "Mortgage cap" },
      { href: "../retirement-limits/", label: "401(k) / IRA" },
      { href: "../mileage/", label: "Mileage" },
      { href: "../hsa-limits/", label: "HSA" },
      { href: "../standard-deduction/", label: "Standard deduction" },
      { href: "../tax-brackets/", label: "Tax rates" },
    ],
    "hsa-limits/index.html": [
      HOME_LINK,
      { href: "../wa-heat-pump-rebate/", label: "Heat pump rebate" },
      { href: "../paint-coverage/", label: "Paint" },
      { href: "../concrete-bags/", label: "Concrete" },
      { href: "../mortgage-limit/", label: "Mortgage cap" },
      { href: "../retirement-limits/", label: "401(k) / IRA" },
      { href: "../mileage/", label: "Mileage" },
      { href: "../standard-deduction/", label: "Standard deduction" },
      { href: "../tax-brackets/", label: "Tax rates" },
      { href: "../fsa-limits/", label: "Health FSA" },
    ],
    "tax-brackets/index.html": [
      HOME_LINK,
      { href: "../wa-heat-pump-rebate/", label: "Heat pump rebate" },
      { href: "../paint-coverage/", label: "Paint" },
      { href: "../concrete-bags/", label: "Concrete" },
      { href: "../mortgage-limit/", label: "Mortgage cap" },
      { href: "../retirement-limits/", label: "401(k) / IRA" },
      { href: "../mileage/", label: "Mileage" },
      { href: "../hsa-limits/", label: "HSA" },
      { href: "../standard-deduction/", label: "Standard deduction" },
      { href: "../fsa-limits/", label: "Health FSA" },
    ],
    "standard-deduction/index.html": [
      HOME_LINK,
      { href: "../wa-heat-pump-rebate/", label: "Heat pump rebate" },
      { href: "../paint-coverage/", label: "Paint" },
      { href: "../concrete-bags/", label: "Concrete" },
      { href: "../mortgage-limit/", label: "Mortgage cap" },
      { href: "../retirement-limits/", label: "401(k) / IRA" },
      { href: "../mileage/", label: "Mileage" },
      { href: "../hsa-limits/", label: "HSA" },
      { href: "../tax-brackets/", label: "Tax rates" },
      { href: "../fsa-limits/", label: "Health FSA" },
    ],
    "mortgage-limit/index.html": [
      HOME_LINK,
      { href: "../wa-heat-pump-rebate/", label: "Heat pump rebate" },
      { href: "../paint-coverage/", label: "Paint" },
      { href: "../concrete-bags/", label: "Concrete" },
      { href: "../mileage/", label: "Mileage" },
      { href: "../fsa-limits/", label: "Health FSA" },
      { href: "../hsa-limits/", label: "HSA" },
      { href: "../tax-brackets/", label: "Tax rates" },
      { href: "../standard-deduction/", label: "Standard deduction" },
      { href: "../retirement-limits/", label: "401(k) / IRA" },
    ],
    "retirement-limits/index.html": [
      HOME_LINK,
      { href: "../wa-heat-pump-rebate/", label: "Heat pump rebate" },
      { href: "../paint-coverage/", label: "Paint" },
      { href: "../concrete-bags/", label: "Concrete" },
      { href: "../mortgage-limit/", label: "Mortgage cap" },
      { href: "../mileage/", label: "Mileage" },
      { href: "../hsa-limits/", label: "HSA" },
      { href: "../standard-deduction/", label: "Standard deduction" },
      { href: "../tax-brackets/", label: "Tax rates" },
      { href: "../fsa-limits/", label: "Health FSA" },
    ],
    "wa-heat-pump-rebate/index.html": [
      HOME_LINK,
      { href: "../paint-coverage/", label: "Paint" },
      { href: "../concrete-bags/", label: "Concrete" },
      { href: "../mileage/", label: "Mileage" },
      { href: "../fsa-limits/", label: "Health FSA" },
      { href: "../hsa-limits/", label: "HSA" },
      { href: "../tax-brackets/", label: "Tax rates" },
      { href: "../standard-deduction/", label: "Standard deduction" },
      { href: "../mortgage-limit/", label: "Mortgage cap" },
      { href: "../retirement-limits/", label: "401(k) / IRA" },
    ],
    "paint-coverage/index.html": [
      HOME_LINK,
      { href: "../wa-heat-pump-rebate/", label: "Heat pump rebate" },
      { href: "../concrete-bags/", label: "Concrete" },
      { href: "../mileage/", label: "Mileage" },
      { href: "../fsa-limits/", label: "Health FSA" },
      { href: "../hsa-limits/", label: "HSA" },
      { href: "../tax-brackets/", label: "Tax rates" },
      { href: "../standard-deduction/", label: "Standard deduction" },
      { href: "../mortgage-limit/", label: "Mortgage cap" },
      { href: "../retirement-limits/", label: "401(k) / IRA" },
    ],
    "concrete-bags/index.html": [
      HOME_LINK,
      { href: "../wa-heat-pump-rebate/", label: "Heat pump rebate" },
      { href: "../paint-coverage/", label: "Paint" },
      { href: "../mileage/", label: "Mileage" },
      { href: "../fsa-limits/", label: "Health FSA" },
      { href: "../hsa-limits/", label: "HSA" },
      { href: "../tax-brackets/", label: "Tax rates" },
      { href: "../standard-deduction/", label: "Standard deduction" },
      { href: "../mortgage-limit/", label: "Mortgage cap" },
      { href: "../retirement-limits/", label: "401(k) / IRA" },
    ],
  };

  var HOME_PAGE_LINKS = [
    { href: "./wa-heat-pump-rebate/", label: "Heat pump rebate" },
    { href: "./paint-coverage/", label: "Paint" },
    { href: "./concrete-bags/", label: "Concrete" },
    { href: "./mortgage-limit/", label: "Mortgage cap" },
    { href: "./retirement-limits/", label: "401(k) / IRA" },
    { href: "./mileage/", label: "Mileage" },
    { href: "./hsa-limits/", label: "HSA" },
    { href: "./standard-deduction/", label: "Standard deduction" },
    { href: "./tax-brackets/", label: "Tax rates" },
    { href: "./fsa-limits/", label: "Health FSA" },
  ];

  function footerNav(html, page) {
    var footers = html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/g);
    assert.ok(
      footers && footers.length === 1,
      page + " must have exactly one shared site footer"
    );
    assert.ok(
      footers[0].indexOf(
        "Sourced Calc · boring home calculators · not a contractor"
      ) !== -1,
      page + " footer tagline must stay"
    );
    var navs = footers[0].match(
      /<nav aria-label="Calculators">[\s\S]*?<\/nav>/g
    );
    assert.ok(navs && navs.length === 1, page + " footer nav missing");
    var anchors = [];
    var re = /<a href="([^"]+)">([^<]*)<\/a>/g;
    var m;
    while ((m = re.exec(navs[0]))) {
      anchors.push({ href: m[1], label: m[2] });
    }
    assert.strictEqual(
      (navs[0].match(/<a\b/g) || []).length,
      anchors.length,
      page + " footer links must be plain text anchors"
    );
    return anchors;
  }

  function resolveHref(fromFile, href) {
    return path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), href));
  }

  function toPublicPath(resolved) {
    if (resolved === "index.html" || resolved === "." || resolved === "") return "/";
    var rel = resolved.replace(/^\.\//, "");
    if (rel.endsWith("/index.html")) rel = rel.slice(0, -"index.html".length);
    if (!rel.endsWith("/")) rel += "/";
    if (rel.charAt(0) !== "/") rel = "/" + rel;
    return rel;
  }

  function fileForPublicPath(publicPath) {
    if (publicPath === "/") return "index.html";
    return publicPath.replace(/^\//, "") + "index.html";
  }

  function assertTitleIsTheOneInTheFile(html, page) {
    var tags = html.match(/<title\b[^>]*>[\s\S]*?<\/title>/gi) || [];
    assert.strictEqual(
      tags.length,
      1,
      page + " must keep the single <title> already in the file"
    );
    var footerAt = html.indexOf("<footer");
    if (footerAt === -1) {
      assert.ok(html.indexOf(tags[0]) !== -1, page + " <title> must stay in the file");
      return;
    }
    assert.ok(
      html.indexOf(tags[0]) < footerAt,
      page + " <title> must stay in the file ahead of the footer"
    );
    assert.ok(
      html.slice(footerAt).indexOf("<title") === -1,
      page + " footer must not carry a <title>"
    );
  }

  var locs = [];
  sitemap.replace(/<loc>([^<]+)<\/loc>/g, function (_, loc) {
    locs.push(loc);
    return _;
  });
  var calculatorPaths = locs
    .map(function (loc) {
      return new URL(loc).pathname;
    })
    .filter(function (p) {
      return p !== "/";
    });
  assert.strictEqual(calculatorPaths.length, 10, "sitemap calculator pages");

  locs.forEach(function (loc) {
    var pagePath = new URL(loc).pathname;
    var pageFile =
      pagePath === "/" ? "index.html" : pagePath.replace(/^\//, "") + "index.html";
    var html = fs.readFileSync(path.join(root, pageFile), "utf8");
    assertTitleIsTheOneInTheFile(html, pageFile);
    var anchors = footerNav(html, pageFile);
    var linked = anchors.map(function (a) {
      var resolved = resolveHref(pageFile, a.href);
      var dest = fileForPublicPath(toPublicPath(resolved));
      assert.ok(
        fs.existsSync(path.join(root, dest)),
        pageFile + " footer href " + a.href + " must resolve to " + dest
      );
      return toPublicPath(resolved);
    });
    assert.ok(
      linked.indexOf(pagePath) === -1,
      pageFile + " must not link to itself"
    );
    calculatorPaths.forEach(function (calcPath) {
      if (calcPath === pagePath) return;
      assert.ok(
        linked.indexOf(calcPath) !== -1,
        pageFile + " footer must link to " + calcPath
      );
    });
    if (pagePath === "/") {
      assert.deepStrictEqual(anchors, HOME_PAGE_LINKS, "home footer must stay unchanged");
      return;
    }
    assert.ok(
      anchors.some(function (a) {
        return a.href === "../index.html" && a.label === "Home";
      }),
      pageFile + " must still include the Home link"
    );
    assert.deepStrictEqual(
      anchors[0],
      HOME_LINK,
      pageFile + " Home link must stay first, as on main"
    );
    assert.deepStrictEqual(
      anchors,
      EXPECTED[pageFile],
      pageFile + " footer links must keep existing ones and add the rest, in order"
    );
  });

  var notFound = fs.readFileSync(path.join(root, "404.html"), "utf8");
  assertTitleIsTheOneInTheFile(notFound, "404.html");
  assert.ok(
    notFound.indexOf("site-footer") === -1,
    "404 must stay without the shared calculator footer"
  );

  var footerLinkCss = stylesCss.match(/\.site-footer a\s*\{([^}]+)\}/);
  assert.ok(footerLinkCss, ".site-footer a rule missing");
  assert.ok(
    /min-height:\s*44px/.test(footerLinkCss[1]),
    ".site-footer a must be at least 44px tall"
  );
})();

console.log("ok");
