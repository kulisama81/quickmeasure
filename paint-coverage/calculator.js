/**
 * Interior rectangular-room paint gallons.
 * Walls only: 2 × (L + W) × H, minus typical door/window rectangles.
 *
 * Coverage default is within Sherwin-Williams SuperPaint PDS 350–400 sq ft/gal
 * at 4 mils wet. Door/window sizes are typical openings, not manufacturer coverage.
 */
(function (root) {
  // Within SuperPaint PDS 350–400 sq ft/gal at 4 mils wet (see /paint-coverage/ sources).
  var DEFAULT_COVERAGE = 350;
  // Typical openings — not manufacturer coverage.
  var DOOR_SQFT = 20; // 3 ft × 6 ft 8 in interior door
  var WINDOW_SQFT = 15; // 3 ft × 5 ft typical window opening

  function calc(input) {
    var length = Number(input.length);
    var width = Number(input.width);
    var height = Number(input.height);
    var doors = Number(input.doors);
    var windows = Number(input.windows);
    var coats = Number(input.coats);
    var coverage = Number(input.coverage);
    if (!(coverage > 0) && input.coverage == null) {
      coverage = DEFAULT_COVERAGE;
    }

    if (
      !(length > 0) ||
      !(width > 0) ||
      !(height > 0) ||
      !(coats > 0) ||
      !(coverage > 0)
    ) {
      return {
        error:
          "Enter length, width, height, coats, and coverage greater than zero.",
      };
    }
    if (doors < 0 || windows < 0 || !isFinite(doors) || !isFinite(windows)) {
      return { error: "Door and window counts cannot be negative." };
    }

    var gross = 2 * (length + width) * height;
    var openings = doors * DOOR_SQFT + windows * WINDOW_SQFT;
    var net = Math.max(0, gross - openings);
    var paintSqFt = net * coats;
    var raw = paintSqFt / coverage;
    var buy = raw <= 0 ? 0 : Math.ceil(raw - 1e-9);

    return {
      doorSqFt: DOOR_SQFT,
      windowSqFt: WINDOW_SQFT,
      gross: gross,
      openings: openings,
      net: net,
      paintSqFt: paintSqFt,
      raw: raw,
      buy: buy,
      coverage: coverage,
      coats: coats,
    };
  }

  root.qmPaint = {
    calc: calc,
    DEFAULT_COVERAGE: DEFAULT_COVERAGE,
    DOOR_SQFT: DOOR_SQFT,
    WINDOW_SQFT: WINDOW_SQFT,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = globalThis.qmPaint;
}
