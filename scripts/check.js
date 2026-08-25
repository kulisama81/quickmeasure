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

const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
assert.ok(sitemap.includes("https://sourcedcalc.com/paint-coverage/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/concrete-bags/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/wa-heat-pump-rebate/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/mortgage-limit/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/retirement-limits/"));
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
];
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
});

var notFound = fs.readFileSync(path.join(root, "404.html"), "utf8");
assert.ok(notFound.includes("Sourced Calc"));
assert.ok(notFound.indexOf("Quick Measure") === -1);

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

var retUnder = ret("workplace", 49, 20000);
assert.strictEqual(retUnder.over, false);
assert.ok(/under this cap/i.test(retUnder.comparison));
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
assert.ok(!/G-[A-Z0-9]+/.test(retHtml), "no invented GA4 id");
assert.ok(!/gtag\(|googletagmanager/i.test(retHtml));

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

const homeHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(homeHtml.includes("./retirement-limits/"));
assert.ok(
  homeHtml.includes(
    "How much you can put in a 401(k) or IRA this year (2026)"
  )
);
assertNoAds(homeHtml, "index.html");
assertNoAds(retHtml, "retirement-limits");

console.log("ok");
