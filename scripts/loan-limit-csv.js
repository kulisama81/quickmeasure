/**
 * Parse the official FHFA all-counties conforming loan limit CSV.
 * Figures come only from that file. Do not invent dollars here.
 */
function stripBom(text) {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

function parseCsv(text) {
  text = stripBom(String(text));
  var rows = [];
  var row = [];
  var field = "";
  var i = 0;
  var inQuotes = false;
  while (i < text.length) {
    var c = text.charAt(i);
    if (inQuotes) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

function parseMoney(s) {
  var n = Number(String(s).replace(/\$/g, "").replace(/,/g, "").trim());
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function titleCaseName(raw) {
  var s = String(raw).trim().toLowerCase();
  return s.replace(/(^|[\s\-./])([a-z])/g, function (_, a, b) {
    return a + b.toUpperCase();
  });
}

function parseOfficialCsv(text) {
  var rows = parseCsv(text);
  if (!rows.length) throw new Error("CSV is empty");
  var header = rows[0].map(function (h) {
    return String(h).replace(/\s+/g, " ").trim().toLowerCase();
  });
  function col(name) {
    var i = header.indexOf(name);
    if (i === -1) throw new Error("CSV missing column: " + name);
    return i;
  }
  var iStateFips = col("fips state code");
  var iCountyFips = col("fips county code");
  var iName = col("county name");
  var iState = col("state");
  var iOne = col("one-unit limit");
  var iTwo = col("two-unit limit");
  var iThree = col("three-unit limit");
  var iFour = col("four-unit limit");

  var out = [];
  for (var r = 1; r < rows.length; r += 1) {
    var row = rows[r];
    var one = parseMoney(row[iOne]);
    var two = parseMoney(row[iTwo]);
    var three = parseMoney(row[iThree]);
    var four = parseMoney(row[iFour]);
    if (one == null || two == null || three == null || four == null) {
      throw new Error("CSV row missing a 1–4 unit limit: " + row.join("|"));
    }
    var stateFips = String(row[iStateFips]).trim().padStart(2, "0");
    var countyFips = String(row[iCountyFips]).trim().padStart(3, "0");
    out.push({
      fips: stateFips + countyFips,
      state: String(row[iState]).trim().toUpperCase(),
      name: titleCaseName(row[iName]),
      rawName: String(row[iName]).trim(),
      limits: [one, two, three, four],
    });
  }
  return out;
}

module.exports = {
  parseCsv: parseCsv,
  parseMoney: parseMoney,
  parseOfficialCsv: parseOfficialCsv,
  titleCaseName: titleCaseName,
};
