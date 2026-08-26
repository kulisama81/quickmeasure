/**
 * 2026 IRS standard deduction lookup.
 * Dollars come only from the IRS 2026 inflation newsroom post and Rev. Proc. 2025-32.
 * Never invent a senior bonus that is not on those two pages.
 */
(function (root) {
  var YEAR = 2026;

  var SINGLE = 16100;
  var MFS = 16100;
  var MFJ = 32200;
  var SURVIVING_SPOUSE = 32200;
  var HOH = 24150;

  var EXTRA_MARRIED_OR_SS = 1650;
  var EXTRA_UNMARRIED = 2050;

  var DEPENDENT_FLOOR = 1350;
  var DEPENDENT_EARNED_ADDON = 450;

  var HUMAN_LINE =
    "This is the amount the IRS lets most people subtract before tax, instead of listing every deduction.";

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
    if (
      s === "mfs" ||
      s === "separate" ||
      s === "married-separate" ||
      s === "married, filing your own return" ||
      s === "married filing separately"
    ) {
      return "mfs";
    }
    if (
      s === "hoh" ||
      s === "head" ||
      s === "head of household" ||
      s === "head-of-household"
    ) {
      return "hoh";
    }
    if (
      s === "ss" ||
      s === "qw" ||
      s === "surviving spouse" ||
      s === "surviving-spouse" ||
      s === "qualifying widow" ||
      s === "qualifying surviving spouse"
    ) {
      return "ss";
    }
    return "";
  }

  function statusLabel(kind) {
    if (kind === "single") return "Just you";
    if (kind === "mfj") return "You and a spouse together";
    if (kind === "mfs") return "Married, filing your own return";
    if (kind === "hoh") return "Head of household";
    if (kind === "ss") return "Surviving spouse";
    return "";
  }

  function officialName(kind) {
    if (kind === "single") return "single";
    if (kind === "mfj") return "married filing jointly";
    if (kind === "mfs") return "married filing separately";
    if (kind === "hoh") return "head of household";
    if (kind === "ss") return "surviving spouse";
    return "";
  }

  function baseFor(kind) {
    if (kind === "single") return SINGLE;
    if (kind === "mfs") return MFS;
    if (kind === "mfj") return MFJ;
    if (kind === "ss") return SURVIVING_SPOUSE;
    if (kind === "hoh") return HOH;
    return 0;
  }

  function extraEach(kind) {
    if (kind === "single" || kind === "hoh") return EXTRA_UNMARRIED;
    return EXTRA_MARRIED_OR_SS;
  }

  function lookup(input) {
    input = input || {};
    var kind = filingKind(input.status);
    var age65 = parseYesNo(input.age65);
    var blind = parseYesNo(input.blind);
    var spouseAge65 = parseYesNo(input.spouseAge65);
    var spouseBlind = parseYesNo(input.spouseBlind);
    var dependent = parseYesNo(input.dependent);
    var earned = parseAmount(input.earned);

    if (!kind) {
      if (input.status && String(input.status).trim()) {
        return {
          error:
            "We do not have an official dollar for that filing status on this page.",
        };
      }
      return { error: "Choose how you file this year." };
    }
    if (age65 === undefined) {
      return {
        error: "Choose yes or no for whether you are 65 or older this year.",
      };
    }
    if (age65 === null) {
      return { error: "Choose whether you are 65 or older this year." };
    }
    if (blind === undefined) {
      return { error: "Choose yes or no for whether you are blind." };
    }
    if (blind === null) {
      return { error: "Choose whether you are blind." };
    }
    if (dependent === undefined) {
      return {
        error:
          "Choose yes or no for whether someone else can claim you as a dependent.",
      };
    }
    if (dependent === null) {
      return {
        error: "Choose whether someone else can claim you as a dependent.",
      };
    }

    var joint = kind === "mfj";
    if (joint) {
      if (spouseAge65 === undefined) {
        return {
          error:
            "Choose yes or no for whether your spouse is 65 or older this year.",
        };
      }
      if (spouseAge65 === null) {
        return {
          error: "Choose whether your spouse is 65 or older this year.",
        };
      }
      if (spouseBlind === undefined) {
        return {
          error: "Choose yes or no for whether your spouse is blind.",
        };
      }
      if (spouseBlind === null) {
        return { error: "Choose whether your spouse is blind." };
      }
    } else {
      spouseAge65 = false;
      spouseBlind = false;
    }

    if (dependent) {
      if (earned === null) {
        return {
          error:
            "Type how much you earned from work this year, or 0 if you did not earn from work.",
        };
      }
      if (!isFinite(earned)) {
        return {
          error: "What you earned from work has to be a number, or 0.",
        };
      }
    } else {
      earned = null;
    }

    var usual = baseFor(kind);
    var basic = usual;
    if (dependent) {
      var limited = Math.max(DEPENDENT_FLOOR, DEPENDENT_EARNED_ADDON + earned);
      basic = Math.min(usual, limited);
    }

    var extraUnit = extraEach(kind);
    var extraCount = 0;
    if (age65) extraCount += 1;
    if (blind) extraCount += 1;
    if (joint && spouseAge65) extraCount += 1;
    if (joint && spouseBlind) extraCount += 1;
    var extra = extraCount * extraUnit;
    var limit = basic + extra;

    var extraNote = null;
    if (extra) {
      extraNote =
        formatDollar(extra) +
        " extra because of being 65 or older and/or blind. Each of those extras is " +
        formatDollar(extraUnit) +
        " for how you file. Age and blind can both apply.";
    }

    var dependentNote = null;
    if (dependent) {
      dependentNote =
        "Someone else can claim you, so the starting amount is the greater of " +
        formatDollar(DEPENDENT_FLOOR) +
        " or " +
        formatDollar(DEPENDENT_EARNED_ADDON) +
        " plus what you earned from work, and it cannot go past the usual amount for how you file.";
    }

    return {
      year: YEAR,
      status: kind,
      statusLabel: statusLabel(kind),
      officialName: officialName(kind),
      age65: age65,
      blind: blind,
      spouseAge65: joint ? spouseAge65 : false,
      spouseBlind: joint ? spouseBlind : false,
      joint: joint,
      dependent: dependent,
      earned: earned,
      usual: usual,
      basic: basic,
      extra: extra,
      extraEach: extraUnit,
      extraCount: extraCount,
      limit: limit,
      limitLabel: formatDollar(limit),
      extraNote: extraNote,
      dependentNote: dependentNote,
      humanLine: HUMAN_LINE,
      headline: formatDollar(limit),
      disclaimer:
        "This is an official IRS figure lookup, not tax advice and not a filing.",
    };
  }

  root.qmStandardDeduction = {
    lookup: lookup,
    formatDollar: formatDollar,
    HUMAN_LINE: HUMAN_LINE,
    YEAR: YEAR,
    SINGLE: SINGLE,
    MFS: MFS,
    MFJ: MFJ,
    SURVIVING_SPOUSE: SURVIVING_SPOUSE,
    HOH: HOH,
    EXTRA_MARRIED_OR_SS: EXTRA_MARRIED_OR_SS,
    EXTRA_UNMARRIED: EXTRA_UNMARRIED,
    DEPENDENT_FLOOR: DEPENDENT_FLOOR,
    DEPENDENT_EARNED_ADDON: DEPENDENT_EARNED_ADDON,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = globalThis.qmStandardDeduction;
}
