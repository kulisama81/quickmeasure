/**
 * Washington heat pump rebate estimate (2026).
 * Official published amounts only. Never invent dollars. Never pick utility from ZIP.
 */
(function (root) {
  var LINKS = {
    pseResistance:
      "https://www.pse.com/en/rebates/heating/electric-resistance-to-air-source-heat-pump-conversion-rebate",
    pseUpgrade:
      "https://www.pse.com/en/rebates/heating/heat-pump-to-heat-pump-upgrade-rebate",
    pseGas: "https://www.pse.com/en/rebates/heating/mi-heatpump",
    pseBoost: "https://www.pse.com/en/rebates/efficiency-boost",
    pseFlyer: "https://www.pse.com/-/media/PDFs/REBATES/3905_wb_RebatesFlyer.pdf",
    seattleCleanHeat:
      "https://seattle.gov/environment/climate-change/buildings-and-energy/seattles-clean-heat-program",
    seattleHeating:
      "https://seattle.gov/city-light/residential-services/home-energy-solutions/heating-and-cooling-your-home",
    hear: "https://www.commerce.wa.gov/energy-incentives/hear/",
    ira: "https://www.commerce.wa.gov/energy-incentives/ira-home-energy-rebates/",
    irs: "https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb",
  };

  var DISCLAIMER =
    "This is a conservative reading of public program pages, not a quote, bid, incentive reservation, or legal, tax, or eligibility determination. Amounts, stacking, contractor rules, and income tests change. Verify with the utility, the City of Seattle, Commerce, and your contractor before you buy.";

  var NOT_INCLUDED = [
    "Federal 25C / 25D tax credits — ended December 31, 2025 (placed in service / expenditures after that date).",
    "Federal HARP / HOMES — not live in Washington. Commerce is evaluating DOE notices dated June 1, 2026. Do not budget $8,000.",
    "Invented Snohomish, Tacoma, Avista, or other-utility dollars.",
    "Seattle Office of Housing marketing averages treated as a rebate dollar.",
    "Stacking that the source pages do not confirm (including Clean Heat + Seattle City Light discount).",
    "Hybrid gas + $4,000 full gas-switch on the same project.",
  ];

  function zipHint(zip) {
    var raw = String(zip || "").trim();
    if (!raw) return null;
    var digits = raw.replace(/\D/g, "");
    if (digits.length !== 5) {
      return "Enter a 5-digit ZIP if you want a Washington hint. ZIP is never used to pick a utility.";
    }
    if (digits.indexOf("98") !== 0) {
      return "This ZIP does not look like Washington (98xxx). This page only lists Washington programs. We still do not pick a utility from ZIP.";
    }
    return "ZIP looks like Washington. It is only a hint — we do not assign PSE, Seattle City Light, or any other utility from ZIP.";
  }

  function hearBlock(income) {
    if (income === "under150") {
      return {
        title: "Washington HEAR",
        body: "Your selection is at or under 150% AMI, which is the state HEAR screen (HUD county limits). Commerce does not publish a statewide heat-pump dollar. Local administrators set amounts. Email HomeRebates@Commerce.wa.gov with subject “State Home Electrification and Appliance Rebates (HEAR) Program.”",
      };
    }
    if (income === "over150") {
      return {
        title: "Washington HEAR",
        body: "HEAR is for households at or under 150% AMI (HUD county). Based on this selection you are outside that screen. Do not add a made-up HEAR number.",
      };
    }
    return {
      title: "Washington HEAR",
      body: "HEAR is for households at or under 150% AMI using HUD county limits. Commerce does not publish a statewide heat-pump dollar. Local administrators. Email HomeRebates@Commerce.wa.gov.",
    };
  }

  function sclDiscountBullets() {
    return [
      "Seattle City Light contractor instant discounts for qualifying air-source heat pumps under 5.4 tons: $300 (SEER2 15.2 / HSPF2 ≥ 8.1), $400 (SEER2 15.2 / HSPF2 ≥ 8.5), $600 (SEER2 16.0 / HSPF2 ≥ 9.5).",
      "DIY is not eligible. The discount is through participating distributors and the contractor’s bid.",
    ];
  }

  function estimate(input) {
    var utility = input.utility;
    var heat = input.heat;
    var income = input.income;
    var zipWarning = zipHint(input.zip);
    var hear = hearBlock(income);
    var links = [];
    var bullets = [];
    var pill = "unknown";
    var pillLabel = "Unknown";
    var headline = "";

    function addLink(href, label) {
      for (var i = 0; i < links.length; i++) {
        if (links[i].href === href) return;
      }
      links.push({ href: href, label: label });
    }

    addLink(LINKS.hear, "WA Commerce HEAR");
    addLink(LINKS.ira, "WA Commerce IRA Home Energy Rebates (HARP / HOMES)");
    addLink(LINKS.irs, "IRS OBBB 25C / 25D FAQ");

    if (!utility || !heat || !income) {
      return {
        error: "Required: electric utility, current primary heat, and household income.",
      };
    }

    if (utility === "pse") {
      addLink(LINKS.pseResistance, "PSE electric resistance → ASHP");
      addLink(LINKS.pseUpgrade, "PSE heat pump upgrade");
      addLink(LINKS.pseGas, "PSE income-qualified gas switch ($4,000)");
      addLink(LINKS.pseBoost, "PSE Efficiency Boost income table");
      addLink(LINKS.pseFlyer, "PSE rebate flyer (PDF)");

      if (heat === "electric-furnace" || heat === "zonal") {
        var kind =
          heat === "electric-furnace"
            ? "electric furnace (forced-air electric resistance)"
            : "zonal electric resistance (baseboard, wall, or radiant)";
        bullets.push(
          "PSE published conversion for " +
            kind +
            " → qualifying air-source heat pump: $1,500 standard; $2,400 Efficiency Boost for income-qualified customers on PSE’s own table."
        );
        bullets.push(
          "Trade Ally or Recommended Energy Professional (REP) required. Oil, gas, and propane furnaces/boilers/wall heaters are not eligible for this conversion."
        );
        bullets.push(
          "150% AMI is not the Efficiency Boost test. Check pse.com/boost."
        );
        if (income === "over150") {
          pill = "public";
          pillLabel = "Public figure";
          headline =
            "Published PSE conversion rebate: $1,500 (Trade Ally or REP). Efficiency Boost is a different income table.";
        } else {
          pill = "range";
          pillLabel = "Range";
          headline =
            "Published PSE conversion: $1,500 standard or $2,400 Efficiency Boost (PSE’s income table — not the 150% AMI test).";
        }
      } else if (heat === "heat-pump") {
        bullets.push(
          "PSE heat-pump-to-heat-pump upgrade (centrally ducted all-electric, existing unit out of original manufacturer warranty): $1,500 standard; $2,400 Efficiency Boost on PSE’s table."
        );
        bullets.push(
          "Trade Ally required. Ductless systems are not eligible for this upgrade rebate."
        );
        if (income === "over150") {
          pill = "public";
          pillLabel = "Public figure";
          headline =
            "Published PSE upgrade rebate: $1,500 if the existing centrally ducted all-electric heat pump is out of original manufacturer warranty.";
        } else {
          pill = "range";
          pillLabel = "Range";
          headline =
            "Published PSE upgrade: $1,500 or $2,400 Boost (centrally ducted all-electric, out of original manufacturer warranty; PSE income table).";
        }
      } else if (heat === "gas") {
        bullets.push(
          "Income-qualified full gas switch: $4,000. This uses PSE’s own income table — it is not automatic from 150% AMI."
        );
        bullets.push(
          "Hybrid gas furnace path: the current rebate flyer lists $1,500 / $2,400 Boost. Older PDFs list different hybrid amounts. Treat hybrid as verify. Do not add hybrid + $4,000."
        );
        bullets.push("Trade Ally or REP required. Confirm which path you are actually installing.");
        pill = "range";
        pillLabel = "Range";
        headline =
          "Published PSE gas paths: $4,000 income-qualified full switch (PSE table, not 150% AMI) or a hybrid flyer figure of $1,500 / $2,400 Boost — verify; do not stack.";
      } else if (heat === "oil") {
        bullets.push(
          "No published PSE oil-to-heat-pump rebate found. This page does not invent one."
        );
        bullets.push(
          "PSE’s electric-resistance conversion page says furnaces, boilers, or wall heaters that use oil are not eligible for that $1,500 / $2,400."
        );
        pill = "unknown";
        pillLabel = "Unknown";
        headline = "No published PSE oil-to-heat-pump rebate found.";
      } else {
        bullets.push(
          "Current heat is unknown, so this page will not pick a PSE dollar. Published paths if you later confirm heat: electric resistance → ASHP $1,500 / $2,400 Boost; HP-to-HP (centrally ducted, out of warranty) $1,500 / $2,400 Boost; income-qualified full gas switch $4,000; hybrid flyer $1,500 / $2,400 with conflicting older PDFs; oil: none published."
        );
        pill = "unknown";
        pillLabel = "Unknown";
        headline = "Choose current heat to map a published PSE figure. This page will not guess.";
      }
    } else if (utility === "scl") {
      addLink(LINKS.seattleCleanHeat, "Seattle Clean Heat");
      addLink(LINKS.seattleHeating, "Seattle City Light heating & cooling");

      sclDiscountBullets().forEach(function (b) {
        bullets.push(b);
      });

      if (heat === "oil") {
        bullets.push(
          "Seattle Clean Heat (oil → qualifying Mitsubishi, participating contractor): $2,000 instant at any income."
        );
        bullets.push(
          "Extra $4,000 bonus for 81%–150% AMI if installed by September 30, 2026 (up to $6,000 combined)."
        );
        bullets.push(
          "Lower income: possible free Office of Housing conversion. Do not treat Housing marketing averages as a rebate dollar."
        );
        bullets.push(
          "Stacking Clean Heat + the City Light contractor discount is not confirmed additive — say verify."
        );
        if (income === "over150") {
          pill = "public";
          pillLabel = "Public figure";
          headline =
            "Published Seattle Clean Heat instant rebate: $2,000 (bonus is 81%–150% AMI, install by Sept 30, 2026).";
        } else {
          pill = "range";
          pillLabel = "Range";
          headline =
            "Published Seattle Clean Heat: $2,000 instant; up to $6,000 with the 81%–150% AMI bonus if installed by September 30, 2026.";
        }
      } else {
        bullets.push(
          "Seattle Clean Heat is an oil-to-qualifying-Mitsubishi program. It is not listed here for gas, electric resistance, or existing heat pumps."
        );
        bullets.push(
          "City Light discount + Clean Heat stacking is not an issue on this heat type; still verify the contractor discount on the invoice."
        );
        pill = "range";
        pillLabel = "Range";
        headline =
          "Published Seattle City Light contractor discounts: $300 / $400 / $600 under 5.4 tons, by SEER2 and HSPF2. DIY not eligible.";
        if (heat === "unknown") {
          pill = "unknown";
          pillLabel = "Unknown";
          headline =
            "City Light lists $300–$600 contractor discounts. Clean Heat ($2,000–$6,000) applies only if primary heat is oil — confirm heat before using that range.";
        }
      }
    } else if (utility === "other") {
      bullets.push(
        "Other Washington utility: unknown on this page. Do not invent Snohomish, Tacoma, Avista, or other amounts."
      );
      bullets.push("Ask your utility and a contractor. HEAR may still apply if you are in the AMI screen.");
      pill = "unknown";
      pillLabel = "Unknown";
      headline = "No published rebate dollar for this utility on this page.";
    } else {
      bullets.push(
        "Electric utility is unknown. This page never assigns PSE or Seattle City Light from ZIP."
      );
      bullets.push(
        "If you are PSE: published electric-resistance and HP-upgrade figures are $1,500 / $2,400 Boost; full gas switch $4,000 on PSE’s table; oil: none published."
      );
      bullets.push(
        "If you are Seattle City Light: contractor discounts $300 / $400 / $600; oil Clean Heat $2,000 (up to $6,000 with bonus)."
      );
      pill = "unknown";
      pillLabel = "Unknown";
      headline = "Choose your electric utility. ZIP is not used to pick it.";
    }

    return {
      pill: pill,
      pillLabel: pillLabel,
      headline: headline,
      bullets: bullets,
      hear: hear,
      notIncluded: NOT_INCLUDED,
      links: links,
      disclaimer: DISCLAIMER,
      zipWarning: zipWarning,
    };
  }

  root.qmWa = { estimate: estimate, LINKS: LINKS };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = globalThis.qmWa;
}
