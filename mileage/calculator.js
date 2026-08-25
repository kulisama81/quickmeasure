/**
 * 2026 IRS standard mileage rates.
 * Cents come only from the IRS standard mileage rates page,
 * Notice 2026-10 (Jan–Jun), and Announcement 2026-11 / IR-2026-29 (Jul–Dec).
 * Never invent a rate. Charity is 14¢ both halves. No other year.
 */
(function (root) {
  var YEAR = 2026;

  var HUMAN_LINE = "This is how much the IRS says one mile is worth.";

  var RATES = {
    first: {
      period: "first",
      periodLabel: "January 1 through June 30, 2026",
      business: 72.5,
      charity: 14,
      medical: 20.5,
      moving: 20.5,
    },
    second: {
      period: "second",
      periodLabel: "July 1 through December 31, 2026",
      business: 76,
      charity: 14,
      medical: 23.5,
      moving: 23.5,
    },
  };

  var TYPE_LABELS = {
    business: "business or self-employed",
    charity: "charity",
    medical: "medical",
    moving: "moving for military",
  };

  function formatCents(cents) {
    var n = Number(cents);
    if (n === Math.floor(n)) return String(n) + "¢";
    return n.toFixed(1) + "¢";
  }

  function formatDollar(n) {
    var rounded = Math.round(Number(n) * 100) / 100;
    return (
      "$" +
      rounded.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function parseDate(raw) {
    if (raw == null) return null;
    var s = String(raw).trim();
    if (!s) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return { invalid: true };
    var y = Number(m[1]);
    var mo = Number(m[2]);
    var d = Number(m[3]);
    var dt = new Date(y, mo - 1, d);
    if (
      dt.getFullYear() !== y ||
      dt.getMonth() !== mo - 1 ||
      dt.getDate() !== d
    ) {
      return { invalid: true };
    }
    return { year: y, month: mo, day: d, iso: s };
  }

  function parseMiles(raw) {
    if (raw == null) return null;
    var s = String(raw).trim();
    if (!s) return null;
    var n = Number(s.replace(/,/g, "").trim());
    if (!isFinite(n) || n < 0) return NaN;
    return n;
  }

  function tripKind(raw) {
    var s = String(raw || "")
      .trim()
      .toLowerCase();
    if (s === "business" || s === "self-employed" || s === "self_employed") {
      return "business";
    }
    if (s === "charity") return "charity";
    if (s === "medical") return "medical";
    if (s === "moving" || s === "military" || s === "moving-military") {
      return "moving";
    }
    return "";
  }

  function periodFor(date) {
    if (date.month <= 6) return RATES.first;
    return RATES.second;
  }

  function lookup(input) {
    input = input || {};
    var date = parseDate(input.date);
    var kind = tripKind(input.type || input.kind || input.trip);
    var miles = parseMiles(input.miles);

    if (!date) {
      return { error: "Choose when the trip was." };
    }
    if (date.invalid) {
      return { error: "Trip date has to be a real calendar date." };
    }
    if (date.year !== YEAR) {
      return {
        error:
          "This page only has the official 2026 rates. We do not invent a rate for that date.",
      };
    }
    if (!kind) {
      if (
        (input.type && String(input.type).trim()) ||
        (input.kind && String(input.kind).trim()) ||
        (input.trip && String(input.trip).trim())
      ) {
        return {
          error:
            "We do not have an official rate for that kind of trip on this page.",
        };
      }
      return { error: "Choose what kind of trip this was." };
    }
    if (miles !== null && !isFinite(miles)) {
      return { error: "Miles has to be a number, or left blank." };
    }

    var period = periodFor(date);
    var rateCents = period[kind];

    var total = null;
    var totalLabel = null;
    if (miles !== null) {
      total = (miles * rateCents) / 100;
      totalLabel = formatDollar(total);
    }

    var milesWord = miles === 1 ? "mile" : "miles";

    return {
      year: YEAR,
      date: date.iso,
      type: kind,
      typeLabel: TYPE_LABELS[kind],
      period: period.period,
      periodLabel: period.periodLabel,
      rateCents: rateCents,
      rateLabel: formatCents(rateCents) + " a mile",
      miles: miles,
      total: total,
      totalLabel: totalLabel,
      humanLine: HUMAN_LINE,
      headline: formatCents(rateCents) + " a mile",
      comparison:
        miles !== null
          ? totalLabel +
            " for " +
            miles +
            " " +
            milesWord +
            " (" +
            formatCents(rateCents) +
            " × " +
            miles +
            ")."
          : null,
      disclaimer: "This is an estimate, not tax advice or a quote.",
    };
  }

  root.qmMileage = {
    lookup: lookup,
    formatCents: formatCents,
    formatDollar: formatDollar,
    HUMAN_LINE: HUMAN_LINE,
    YEAR: YEAR,
    RATES: RATES,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = globalThis.qmMileage;
}
