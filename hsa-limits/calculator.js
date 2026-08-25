/**
 * 2026 HSA yearly contribution limits.
 * Dollars come only from Rev. Proc. 2025-19 (PDF + IRB 2025-21) and Pub 969.
 * Never invent a limit (no excepted-benefit HRA figure).
 */
(function (root) {
  var YEAR = 2026;

  var SELF_BASE = 4400;
  var FAMILY_BASE = 8750;
  var AGE_55_EXTRA = 1000;

  var SELF_MIN_DEDUCTIBLE = 1700;
  var FAMILY_MIN_DEDUCTIBLE = 3400;
  var SELF_MAX_OOP = 8500;
  var FAMILY_MAX_OOP = 17000;

  var HUMAN_LINE = "How much you can put in an HSA this year";

  function formatDollar(n) {
    return "$" + Number(n).toLocaleString("en-US");
  }

  function coverageKind(raw) {
    var s = String(raw || "")
      .trim()
      .toLowerCase();
    if (
      s === "self" ||
      s === "self-only" ||
      s === "self_only" ||
      s === "just-you" ||
      s === "just you"
    ) {
      return "self";
    }
    if (
      s === "family" ||
      s === "you and family" ||
      s === "you-and-family" ||
      s === "you_and_family"
    ) {
      return "family";
    }
    return "";
  }

  function parseYesNo(raw) {
    if (raw == null) return null;
    var s = String(raw).trim().toLowerCase();
    if (!s) return null;
    if (s === "yes" || s === "true" || s === "1") return true;
    if (s === "no" || s === "false" || s === "0") return false;
    return undefined;
  }

  function coverageLabel(kind) {
    if (kind === "self") return "Just you";
    if (kind === "family") return "You and family";
    return "";
  }

  function lookup(input) {
    input = input || {};
    var kind = coverageKind(input.coverage);
    var age55 = parseYesNo(input.age55);

    if (!kind) {
      if (input.coverage && String(input.coverage).trim()) {
        return {
          error:
            "We do not have an official dollar for that coverage on this page.",
        };
      }
      return { error: "Choose who is on the health plan." };
    }
    if (age55 === undefined) {
      return {
        error: "Choose yes or no for whether you are 55 or older this year.",
      };
    }
    if (age55 === null) {
      return { error: "Choose whether you are 55 or older this year." };
    }

    var base = kind === "self" ? SELF_BASE : FAMILY_BASE;
    var extra = age55 ? AGE_55_EXTRA : 0;
    var limit = base + extra;
    var minDeductible =
      kind === "self" ? SELF_MIN_DEDUCTIBLE : FAMILY_MIN_DEDUCTIBLE;
    var maxOop = kind === "self" ? SELF_MAX_OOP : FAMILY_MAX_OOP;

    var extraNote = null;
    if (extra) {
      extraNote =
        "Extra $1,000 because you are 55 or older at year-end. That extra is from IRS Publication 969.";
    }

    var planNote =
      "To use an HSA, the plan has to have a yearly deductible of at least " +
      formatDollar(minDeductible) +
      ", and yearly out-of-pocket costs (not counting premiums) cannot go past " +
      formatDollar(maxOop) +
      ".";

    return {
      year: YEAR,
      coverage: kind,
      coverageLabel: coverageLabel(kind),
      age55: age55,
      base: base,
      extra: extra,
      limit: limit,
      limitLabel: formatDollar(limit),
      minDeductible: minDeductible,
      maxOop: maxOop,
      extraNote: extraNote,
      planNote: planNote,
      humanLine: HUMAN_LINE,
      headline: formatDollar(limit),
      disclaimer: "This is not tax advice.",
    };
  }

  root.qmHsa = {
    lookup: lookup,
    formatDollar: formatDollar,
    HUMAN_LINE: HUMAN_LINE,
    YEAR: YEAR,
    SELF_BASE: SELF_BASE,
    FAMILY_BASE: FAMILY_BASE,
    AGE_55_EXTRA: AGE_55_EXTRA,
    SELF_MIN_DEDUCTIBLE: SELF_MIN_DEDUCTIBLE,
    FAMILY_MIN_DEDUCTIBLE: FAMILY_MIN_DEDUCTIBLE,
    SELF_MAX_OOP: SELF_MAX_OOP,
    FAMILY_MAX_OOP: FAMILY_MAX_OOP,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = globalThis.qmHsa;
}
