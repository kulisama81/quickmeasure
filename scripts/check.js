const assert = require("assert");
const path = require("path");
const root = path.join(__dirname, "..");
const wa = require(path.join(root, "wa-heat-pump-rebate/calculator.js"));
const paint = require(path.join(root, "paint-coverage/calculator.js"));
const concrete = require(path.join(root, "concrete-bags/calculator.js"));

function hasDollar(text, n) {
  return String(text).indexOf("$" + n.toLocaleString("en-US")) !== -1 ||
    String(text).indexOf("$" + n) !== -1;
}

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

console.log("ok");
