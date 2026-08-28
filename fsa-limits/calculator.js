/**
 * 2026 health FSA salary-reduction cap and max unused carryover.
 * Dollars come only from the IRS 2026 inflation newsroom post (IR-2025-103)
 * and Rev. Proc. 2025-32 .15 Cafeteria Plans.
 * Never invent dependent-care FSA, transit/parking, QSEHRA, or flex-credit dollars.
 */
(function (root) {
  var YEAR = 2026;

  var SALARY_REDUCTION_LIMIT = 3400;
  var MAX_CARRYOVER = 680;

  var HUMAN_LINE =
    "Under this dollar, you are within the IRS cap for what you set aside from pay; over it, the IRS does not let that salary reduction go higher for the year.";

  function formatDollar(n) {
    return "$" + Number(n).toLocaleString("en-US");
  }

  function parseYesNo(raw) {
    if (raw == null) return null;
    var s = String(raw).trim().toLowerCase();
    if (!s) return null;
    if (s === "yes" || s === "true" || s === "1") return true;
    if (s === "no" || s === "false" || s === "0") return false;
    return undefined;
  }

  function parseAmount(raw) {
    if (raw == null) return null;
    var s = String(raw).trim();
    if (!s) return null;
    var n = Number(s.replace(/\$/g, "").replace(/,/g, "").trim());
    if (!isFinite(n) || n < 0) return NaN;
    return n;
  }

  function lookup(input) {
    input = input || {};
    var carryoverAllowed = parseYesNo(input.carryover);
    var amount = parseAmount(input.amount);

    if (carryoverAllowed === undefined) {
      return {
        error: "We do not have an official dollar for that case on this page.",
      };
    }
    if (carryoverAllowed === null) {
      return {
        error:
          "Choose whether your plan lets unused health FSA money carry to next year.",
      };
    }
    if (amount !== null && !isFinite(amount)) {
      return {
        error: "Planned amount has to be a number, or left blank.",
      };
    }

    var limit = SALARY_REDUCTION_LIMIT;
    var over = amount !== null ? amount > limit : null;
    var comparison = null;
    if (amount !== null) {
      comparison =
        formatDollar(amount) +
        (over ? " is over this cap." : " is under this cap.");
    }

    var carryover = carryoverAllowed ? MAX_CARRYOVER : 0;
    var carryoverNote;
    if (carryoverAllowed) {
      carryoverNote =
        "Your plan lets unused money carry to next year. The official max leftover is $680. That leftover is unused money, not extra you can set aside from this year's pay.";
    } else {
      carryoverNote =
        "Your plan does not let unused money carry to next year, so we are not using the $680 leftover number.";
    }

    return {
      year: YEAR,
      carryoverAllowed: carryoverAllowed,
      carryover: carryover,
      carryoverLabel: carryoverAllowed ? formatDollar(MAX_CARRYOVER) : null,
      carryoverNote: carryoverNote,
      limit: limit,
      limitLabel: formatDollar(limit),
      amount: amount,
      over: over,
      comparison: comparison,
      humanLine: HUMAN_LINE,
      headline: formatDollar(limit),
      disclaimer: "This is an official IRS figure lookup, not tax advice.",
    };
  }

  root.qmFsa = {
    lookup: lookup,
    formatDollar: formatDollar,
    HUMAN_LINE: HUMAN_LINE,
    YEAR: YEAR,
    SALARY_REDUCTION_LIMIT: SALARY_REDUCTION_LIMIT,
    MAX_CARRYOVER: MAX_CARRYOVER,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = globalThis.qmFsa;
}
