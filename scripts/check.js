const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const wa = require(path.join(root, "wa-heat-pump-rebate/calculator.js"));
const paint = require(path.join(root, "paint-coverage/calculator.js"));
const concrete = require(path.join(root, "concrete-bags/calculator.js"));

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
assert.strictEqual(
  host.canonicalRedirect("https://quickmeasure-a3q.pages.dev/paint-coverage/?x=1"),
  "https://sourcedcalc.com/paint-coverage/?x=1"
);
assert.strictEqual(
  host.canonicalRedirect("https://www.sourcedcalc.com/concrete-bags/"),
  "https://sourcedcalc.com/concrete-bags/"
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
assert.ok(middleware.includes('PAGES_DEV_HOST = "quickmeasure-a3q.pages.dev"'));
assert.ok(middleware.includes('PUBLIC_HOST = "sourcedcalc.com"'));
assert.ok(middleware.includes("Response.redirect"));
assert.ok(middleware.includes("301"));
assert.ok(
  !fs.existsSync(path.join(root, "_redirects")),
  "_redirects cannot match hostname; host 301s belong in Functions middleware"
);

const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
assert.ok(sitemap.includes("https://sourcedcalc.com/paint-coverage/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/concrete-bags/"));
assert.ok(sitemap.includes("https://sourcedcalc.com/wa-heat-pump-rebate/"));
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

console.log("ok");
