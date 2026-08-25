/**
 * Bake the official FHFA 2026 all-counties CSV into mortgage-limit/counties.js.
 * Run: node scripts/bake-loan-limits.js
 */
var fs = require("fs");
var path = require("path");
var parse = require("./loan-limit-csv");

var root = path.join(__dirname, "..");
var csvPath = path.join(
  root,
  "mortgage-limit",
  "fullcountyloanlimitlist2026_hera-based_final_flat.csv"
);
var outPath = path.join(root, "mortgage-limit", "counties.js");

var NEWS_BASELINE_1_UNIT = 832750;
var NEWS_CEILING_1_UNIT = 1249125;

var counties = parse.parseOfficialCsv(fs.readFileSync(csvPath, "utf8"));
if (!counties.length) throw new Error("No counties parsed from official CSV");

var rows = counties.map(function (c) {
  return [c.fips, c.state, c.name, c.limits[0], c.limits[1], c.limits[2], c.limits[3]];
});

var payload = {
  year: 2026,
  baseline1Unit: NEWS_BASELINE_1_UNIT,
  ceiling1Unit: NEWS_CEILING_1_UNIT,
  csvFile: "fullcountyloanlimitlist2026_hera-based_final_flat.csv",
  rows: rows,
};

var js =
  "/* Generated from the official FHFA 2026 all-counties CSV. Do not edit by hand.\n" +
  " * Source: https://www.fhfa.gov/document/d/cll/fullcountyloanlimitlist2026_hera-based_final_flat.csv\n" +
  " * Bake: node scripts/bake-loan-limits.js\n" +
  " */\n" +
  "(function (root) {\n" +
  "  root.qmLoanLimitData = " +
  JSON.stringify(payload) +
  ";\n" +
  "})(typeof window !== \"undefined\" ? window : globalThis);\n" +
  "\n" +
  "if (typeof module !== \"undefined\" && module.exports) {\n" +
  "  module.exports = globalThis.qmLoanLimitData;\n" +
  "}\n";

fs.writeFileSync(outPath, js);
console.log("baked", counties.length, "counties ->", path.relative(root, outPath));
