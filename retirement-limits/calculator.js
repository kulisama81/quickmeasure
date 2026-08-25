/**
 * 2026 401(k) / IRA yearly contribution caps.
 * Dollars come only from the IRS 2026 newsroom post and Notice 2025-67.
 * Never invent a limit (no SIMPLE, Roth income cutoffs, or Saver’s Credit).
 */
(function (root) {
  var YEAR = 2026;

  var WORKPLACE_BASE = 24500;
  var WORKPLACE_CATCHUP_50 = 8000;
  var WORKPLACE_CATCHUP_60_63 = 11250;
  var IRA_BASE = 7500;
  var IRA_CATCHUP_50 = 1100;

  var HUMAN_LINE =
    "Under this dollar, you are within the official yearly cap; over it, the IRS does not let you put more in that account this year.";

  function formatDollar(n) {
    return "$" + Number(n).toLocaleString("en-US");
  }

  function parseAge(raw) {
    if (raw == null) return NaN;
    var s = String(raw).trim();
    if (!s) return NaN;
    if (!/^\d+$/.test(s)) return NaN;
    return Number(s);
  }

  function parseAmount(raw) {
    if (raw == null) return null;
    var s = String(raw).trim();
    if (!s) return null;
    var n = Number(s.replace(/\$/g, "").replace(/,/g, "").trim());
    if (!isFinite(n) || n < 0) return NaN;
    return n;
  }

  function accountKind(raw) {
    var s = String(raw || "")
      .trim()
      .toLowerCase();
    if (s === "workplace" || s === "401k" || s === "401(k)") return "workplace";
    if (s === "ira") return "ira";
    return "";
  }

  function workplaceCatchup(age) {
    if (age >= 60 && age <= 63) return WORKPLACE_CATCHUP_60_63;
    if (age >= 50) return WORKPLACE_CATCHUP_50;
    return 0;
  }

  function iraCatchup(age) {
    if (age >= 50) return IRA_CATCHUP_50;
    return 0;
  }

  function accountLabel(kind) {
    if (kind === "workplace") {
      return "a workplace plan (401(k), 403(b), government 457, or TSP)";
    }
    if (kind === "ira") return "an IRA";
    return "";
  }

  function lookup(input) {
    input = input || {};
    var kind = accountKind(input.account);
    var age = parseAge(input.age);
    var amount = parseAmount(input.amount);

    if (!kind) {
      if (input.account && String(input.account).trim()) {
        return {
          error:
            "We do not have an official dollar for that account on this page.",
        };
      }
      return {
        error: "Choose which account this is for.",
      };
    }
    if (!isFinite(age) || age < 0 || age > 120) {
      return {
        error: "Age has to be a whole number from 0 to 120.",
      };
    }
    if (amount !== null && !isFinite(amount)) {
      return {
        error: "Planned amount has to be a number, or left blank.",
      };
    }

    var base = kind === "workplace" ? WORKPLACE_BASE : IRA_BASE;
    var extra = kind === "workplace" ? workplaceCatchup(age) : iraCatchup(age);
    var limit = base + extra;

    var over = amount !== null ? amount > limit : null;
    var comparison = null;
    if (amount !== null) {
      comparison =
        formatDollar(amount) +
        (over ? " is over this cap." : " is under this cap.");
    }

    var extraNote = null;
    if (kind === "workplace" && extra > 0) {
      extraNote =
        "Workplace 401(k) extra at 50 or older is $8,000. Ages 60–63 use $11,250 instead of $8,000. Those workplace extras are not for an IRA.";
    } else if (kind === "ira" && extra === IRA_CATCHUP_50) {
      extraNote =
        "IRA extra at 50 or older is $1,100. That is only for an IRA.";
    }

    return {
      year: YEAR,
      account: kind,
      accountLabel: accountLabel(kind),
      age: age,
      base: base,
      extra: extra,
      limit: limit,
      limitLabel: formatDollar(limit),
      amount: amount,
      over: over,
      comparison: comparison,
      extraNote: extraNote,
      humanLine: HUMAN_LINE,
      headline:
        formatDollar(limit) +
        " for " +
        accountLabel(kind) +
        " at age " +
        age,
      disclaimer: "This is an estimate, not tax advice or a quote.",
    };
  }

  root.qmRetirement = {
    lookup: lookup,
    formatDollar: formatDollar,
    HUMAN_LINE: HUMAN_LINE,
    YEAR: YEAR,
    WORKPLACE_BASE: WORKPLACE_BASE,
    WORKPLACE_CATCHUP_50: WORKPLACE_CATCHUP_50,
    WORKPLACE_CATCHUP_60_63: WORKPLACE_CATCHUP_60_63,
    IRA_BASE: IRA_BASE,
    IRA_CATCHUP_50: IRA_CATCHUP_50,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = globalThis.qmRetirement;
}
