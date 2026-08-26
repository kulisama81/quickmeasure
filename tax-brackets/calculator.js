/**
 * 2026 IRS income-tax rate lookup (just you / you and a spouse together).
 * Dollars come only from the IRS 2026 inflation newsroom post opened 2026-08-26.
 * Never invent head of household or any other filing status.
 */
(function (root) {
  var YEAR = 2026;

  // IRS: 10% for incomes of $12,400 or less (just you) / $24,800 (joint).
  var SINGLE_10_OR_LESS = 12400;
  var JOINT_10_OR_LESS = 24800;

  // IRS: 12% for incomes over these dollars.
  var SINGLE_12_OVER = 12400;
  var JOINT_12_OVER = 24800;

  // IRS: 22% for incomes over these dollars.
  var SINGLE_22_OVER = 50400;
  var JOINT_22_OVER = 100800;

  // IRS: 24% for incomes over these dollars.
  var SINGLE_24_OVER = 105700;
  var JOINT_24_OVER = 211400;

  // IRS: 32% for incomes over these dollars.
  var SINGLE_32_OVER = 201775;
  var JOINT_32_OVER = 403550;

  // IRS: 35% for incomes over these dollars.
  var SINGLE_35_OVER = 256225;
  var JOINT_35_OVER = 512450;

  // IRS: 37% for incomes greater than these dollars.
  var SINGLE_37_OVER = 640600;
  var JOINT_37_OVER = 768700;

  var HUMAN_LINE =
    "This is the rate the IRS uses on the last part of that income, not a rate on all of it.";

  function formatDollar(n) {
    return "$" + Number(n).toLocaleString("en-US");
  }

  function formatRate(n) {
    return String(n) + "%";
  }

  function filingKind(raw) {
    var s = String(raw || "")
      .trim()
      .toLowerCase();
    if (
      s === "single" ||
      s === "just you" ||
      s === "just-you" ||
      s === "just_you"
    ) {
      return "single";
    }
    if (
      s === "mfj" ||
      s === "joint" ||
      s === "married-joint" ||
      s === "you and a spouse together" ||
      s === "you-and-a-spouse-together"
    ) {
      return "mfj";
    }
    return "";
  }

  function statusLabel(kind) {
    if (kind === "single") return "Just you";
    if (kind === "mfj") return "You and a spouse together";
    return "";
  }

  function officialName(kind) {
    if (kind === "single") return "single";
    if (kind === "mfj") return "married filing jointly";
    return "";
  }

  function parseAmount(raw) {
    if (raw == null) return null;
    var s = String(raw).trim();
    if (!s) return null;
    var n = Number(s.replace(/\$/g, "").replace(/,/g, "").trim());
    if (!isFinite(n) || n < 0) return NaN;
    return n;
  }

  function schedule(kind) {
    if (kind === "single") {
      return {
        tenOrLess: SINGLE_10_OR_LESS,
        twelveOver: SINGLE_12_OVER,
        twentyTwoOver: SINGLE_22_OVER,
        twentyFourOver: SINGLE_24_OVER,
        thirtyTwoOver: SINGLE_32_OVER,
        thirtyFiveOver: SINGLE_35_OVER,
        thirtySevenOver: SINGLE_37_OVER,
      };
    }
    return {
      tenOrLess: JOINT_10_OR_LESS,
      twelveOver: JOINT_12_OVER,
      twentyTwoOver: JOINT_22_OVER,
      twentyFourOver: JOINT_24_OVER,
      thirtyTwoOver: JOINT_32_OVER,
      thirtyFiveOver: JOINT_35_OVER,
      thirtySevenOver: JOINT_37_OVER,
    };
  }

  function rateAt(income, lines) {
    if (income > lines.thirtySevenOver) {
      return {
        rate: 37,
        howListed: "greater than " + formatDollar(lines.thirtySevenOver),
      };
    }
    if (income > lines.thirtyFiveOver) {
      return {
        rate: 35,
        howListed: "over " + formatDollar(lines.thirtyFiveOver),
      };
    }
    if (income > lines.thirtyTwoOver) {
      return {
        rate: 32,
        howListed: "over " + formatDollar(lines.thirtyTwoOver),
      };
    }
    if (income > lines.twentyFourOver) {
      return {
        rate: 24,
        howListed: "over " + formatDollar(lines.twentyFourOver),
      };
    }
    if (income > lines.twentyTwoOver) {
      return {
        rate: 22,
        howListed: "over " + formatDollar(lines.twentyTwoOver),
      };
    }
    if (income > lines.twelveOver) {
      return {
        rate: 12,
        howListed: "over " + formatDollar(lines.twelveOver),
      };
    }
    return {
      rate: 10,
      howListed: formatDollar(lines.tenOrLess) + " or less",
    };
  }

  function lookup(input) {
    input = input || {};
    var kind = filingKind(input.status);
    var income = parseAmount(input.income);

    if (!kind) {
      if (input.status && String(input.status).trim()) {
        return {
          error:
            "We do not have an official dollar for that filing status on this page.",
        };
      }
      return { error: "Choose how you file this year." };
    }

    if (income === null) {
      return { error: "Type the income you want to look up." };
    }
    if (!isFinite(income)) {
      return { error: "Income has to be a number, or 0." };
    }

    var lines = schedule(kind);
    var found = rateAt(income, lines);

    return {
      year: YEAR,
      status: kind,
      statusLabel: statusLabel(kind),
      officialName: officialName(kind),
      income: income,
      incomeLabel: formatDollar(income),
      rate: found.rate,
      rateLabel: formatRate(found.rate),
      howListed: found.howListed,
      thresholdNote:
        "The IRS lists " +
        formatRate(found.rate) +
        " for incomes " +
        found.howListed +
        " when you file " +
        statusLabel(kind).toLowerCase() +
        ".",
      humanLine: HUMAN_LINE,
      headline: formatRate(found.rate),
      disclaimer:
        "This is an official IRS figure lookup, not tax advice and not a filing.",
    };
  }

  root.qmTaxBrackets = {
    lookup: lookup,
    formatDollar: formatDollar,
    formatRate: formatRate,
    HUMAN_LINE: HUMAN_LINE,
    YEAR: YEAR,
    SINGLE_10_OR_LESS: SINGLE_10_OR_LESS,
    JOINT_10_OR_LESS: JOINT_10_OR_LESS,
    SINGLE_12_OVER: SINGLE_12_OVER,
    JOINT_12_OVER: JOINT_12_OVER,
    SINGLE_22_OVER: SINGLE_22_OVER,
    JOINT_22_OVER: JOINT_22_OVER,
    SINGLE_24_OVER: SINGLE_24_OVER,
    JOINT_24_OVER: JOINT_24_OVER,
    SINGLE_32_OVER: SINGLE_32_OVER,
    JOINT_32_OVER: JOINT_32_OVER,
    SINGLE_35_OVER: SINGLE_35_OVER,
    JOINT_35_OVER: JOINT_35_OVER,
    SINGLE_37_OVER: SINGLE_37_OVER,
    JOINT_37_OVER: JOINT_37_OVER,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = globalThis.qmTaxBrackets;
}
