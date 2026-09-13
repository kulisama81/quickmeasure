/**
 * 2026 county mortgage-limit lookup.
 * County 1–4 unit dollars come only from the official FHFA all-counties CSV
 * baked into counties.js. Baseline/ceiling are the 2026 news-release figures.
 * Never invent a limit.
 */
(function (root) {
  if (!root.qmLoanLimitData && typeof require === "function") {
    require("./counties.js");
  }

  var HUMAN_LINE =
    "Under this dollar, a normal mortgage; over it, a harder loan, usually a worse rate.";

  var STATE_NAMES = {
    AL: "Alabama",
    AK: "Alaska",
    AZ: "Arizona",
    AR: "Arkansas",
    CA: "California",
    CO: "Colorado",
    CT: "Connecticut",
    DE: "Delaware",
    DC: "District of Columbia",
    FL: "Florida",
    GA: "Georgia",
    HI: "Hawaii",
    ID: "Idaho",
    IL: "Illinois",
    IN: "Indiana",
    IA: "Iowa",
    KS: "Kansas",
    KY: "Kentucky",
    LA: "Louisiana",
    ME: "Maine",
    MD: "Maryland",
    MA: "Massachusetts",
    MI: "Michigan",
    MN: "Minnesota",
    MS: "Mississippi",
    MO: "Missouri",
    MT: "Montana",
    NE: "Nebraska",
    NV: "Nevada",
    NH: "New Hampshire",
    NJ: "New Jersey",
    NM: "New Mexico",
    NY: "New York",
    NC: "North Carolina",
    ND: "North Dakota",
    OH: "Ohio",
    OK: "Oklahoma",
    OR: "Oregon",
    PA: "Pennsylvania",
    PR: "Puerto Rico",
    RI: "Rhode Island",
    SC: "South Carolina",
    SD: "South Dakota",
    TN: "Tennessee",
    TX: "Texas",
    UT: "Utah",
    VT: "Vermont",
    VA: "Virginia",
    VI: "U.S. Virgin Islands",
    WA: "Washington",
    WV: "West Virginia",
    WI: "Wisconsin",
    WY: "Wyoming",
    GU: "Guam",
    AS: "American Samoa",
    MP: "Northern Mariana Islands",
  };

  var data = root.qmLoanLimitData;
  if (!data || !data.rows || !data.rows.length) {
    throw new Error("Official county limit table is missing.");
  }

  var BASELINE_1_UNIT = data.baseline1Unit;
  var CEILING_1_UNIT = data.ceiling1Unit;
  var byFips = Object.create(null);
  var byState = Object.create(null);

  data.rows.forEach(function (row) {
    var rec = {
      fips: String(row[0]),
      state: String(row[1]),
      name: String(row[2]),
      limits: [row[3], row[4], row[5], row[6]],
    };
    byFips[rec.fips] = rec;
    if (!byState[rec.state]) byState[rec.state] = [];
    byState[rec.state].push(rec);
  });

  Object.keys(byState).forEach(function (st) {
    byState[st].sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  });

  function stateName(code) {
    return STATE_NAMES[code] || code;
  }

  function states() {
    return Object.keys(byState)
      .map(function (code) {
        return { code: code, name: stateName(code) };
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
  }

  function countiesIn(state) {
    return (byState[String(state).toUpperCase()] || []).slice();
  }

  function formatDollar(n) {
    return "$" + Number(n).toLocaleString("en-US");
  }

  function unitsLabel(units) {
    if (units === 1) return "a regular house (1 home)";
    if (units === 2) return "a duplex (2 homes)";
    if (units === 3) return "a 3-home building";
    if (units === 4) return "a 4-home building";
    return units + "-home building";
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
    var fips = String(input.fips || "").trim();
    var units = Number(input.units);
    var amount = parseAmount(input.amount);

    if (!fips || !byFips[fips]) {
      return {
        error: "Pick the state and county the home is in.",
      };
    }
    if (units !== 1 && units !== 2 && units !== 3 && units !== 4) {
      return {
        error: "Choose how many homes are in the building (1, 2, 3, or 4).",
      };
    }
    if (amount !== null && !isFinite(amount)) {
      return {
        error: "Borrowing amount has to be a number, or left blank.",
      };
    }

    var rec = byFips[fips];
    var limit = rec.limits[units - 1];
    if (!(limit > 0) || !isFinite(limit)) {
      return {
        error:
          "The official list has no dollar for that county and building size. We do not invent one.",
      };
    }

    var over = amount !== null ? amount > limit : null;
    var comparison = null;
    if (amount !== null) {
      if (amount > limit) {
        comparison = formatDollar(amount) + " is over this cap.";
      } else if (amount === limit) {
        comparison = formatDollar(amount) + " is at this cap.";
      } else {
        comparison = formatDollar(amount) + " is under this cap.";
      }
    }

    return {
      fips: rec.fips,
      state: rec.state,
      stateName: stateName(rec.state),
      county: rec.name,
      units: units,
      unitsLabel: unitsLabel(units),
      limit: limit,
      limitLabel: formatDollar(limit),
      amount: amount,
      over: over,
      comparison: comparison,
      humanLine: HUMAN_LINE,
      headline: limitLabelHeadline(rec, units, limit),
      disclaimer:
        "This is an estimate, not a loan quote, rate, or approval.",
    };
  }

  function limitLabelHeadline(rec, units, limit) {
    return (
      formatDollar(limit) +
      " in " +
      rec.name +
      ", " +
      stateName(rec.state) +
      " for " +
      unitsLabel(units)
    );
  }

  root.qmLoanLimit = {
    lookup: lookup,
    states: states,
    countiesIn: countiesIn,
    formatDollar: formatDollar,
    HUMAN_LINE: HUMAN_LINE,
    BASELINE_1_UNIT: BASELINE_1_UNIT,
    CEILING_1_UNIT: CEILING_1_UNIT,
    YEAR: data.year,
    countyCount: data.rows.length,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = globalThis.qmLoanLimit;
}
