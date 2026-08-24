/**
 * Rectangular slab premix bags.
 * Typical Quikrete-style yields — verify the bag you buy.
 */
(function (root) {
  var YIELD = {
    40: 0.3,
    60: 0.45,
    80: 0.6,
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
