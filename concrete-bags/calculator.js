/**
 * Rectangular slab premix bags.
 * Yields from Quikrete 1101 Concrete Mix PDS and Sakrete High-Strength pages:
 * 40 lb ≈ 0.30 ft³, 60 lb ≈ 0.45 ft³, 80 lb ≈ 0.60 ft³. Estimate, not a quote.
 */
(function (root) {
  // Quikrete 1101 PDS / Sakrete High-Strength (same published yields).
  var YIELD = {
    40: 0.3, // 0.30 ft³
    60: 0.45,
    80: 0.6, // 0.60 ft³
  };

  function calc(input) {
    var length = Number(input.length);
    var width = Number(input.width);
    var thickness = Number(input.thickness);
    var bag = String(input.bag);

    if (!(length > 0) || !(width > 0) || !(thickness > 0)) {
      return {
        error: "Enter length, width, and thickness greater than zero.",
      };
    }
    if (!YIELD[bag]) {
      return { error: "Choose a 40, 60, or 80 lb bag." };
    }

    var cuFt = length * width * (thickness / 12);
    var perBag = YIELD[bag];
    var raw = cuFt / perBag;
    var buy = raw <= 0 ? 0 : Math.ceil(raw - 1e-9);

    return {
      cuFt: cuFt,
      perBag: perBag,
      bag: Number(bag),
      raw: raw,
      buy: buy,
    };
  }

  root.qmConcrete = { calc: calc, YIELD: YIELD };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = globalThis.qmConcrete;
}
