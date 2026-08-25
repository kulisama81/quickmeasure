/**
 * Attach sourcedcalc.com and www.sourcedcalc.com to Pages project `quickmeasure`
 * and create proxied CNAME records if they are missing.
 *
 * Wrangler 4.x has no `pages domain` subcommand. Dashboard equivalent:
 * Workers & Pages → quickmeasure → Custom domains → Set up a domain.
 * API: POST /accounts/{account_id}/pages/projects/{project_name}/domains
 *
 * Requires CLOUDFLARE_API_TOKEN with Account Cloudflare Pages Edit,
 * Zone DNS Edit on sourcedcalc.com, and Account Settings Read.
 * Optional: CLOUDFLARE_ACCOUNT_ID
 *
 * Usage: node scripts/attach-custom-domain.js
 */
var https = require("https");

var PROJECT = "quickmeasure";
var ZONE_NAME = "sourcedcalc.com";
var DOMAINS = ["sourcedcalc.com", "www.sourcedcalc.com"];
var CNAME_TARGET = "quickmeasure-a3q.pages.dev";
var TOKEN = process.env.CLOUDFLARE_API_TOKEN;

function request(method, path, body) {
  return new Promise(function (resolve, reject) {
    var payload = body ? JSON.stringify(body) : null;
    var req = https.request(
      {
        hostname: "api.cloudflare.com",
        path: path,
        method: method,
        headers: {
          Authorization: "Bearer " + TOKEN,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      function (res) {
        var chunks = [];
        res.on("data", function (c) {
          chunks.push(c);
        });
        res.on("end", function () {
          var text = Buffer.concat(chunks).toString("utf8");
          var json;
          try {
            json = JSON.parse(text);
          } catch (e) {
            reject(new Error(res.statusCode + " " + text.slice(0, 500)));
            return;
          }
          if (!json.success) {
            var err = (json.errors && json.errors[0] && json.errors[0].message) || text;
            var wrapped = new Error(method + " " + path + " → " + err);
            wrapped.status = res.statusCode;
            wrapped.body = json;
            reject(wrapped);
            return;
          }
          resolve(json.result);
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function accountId() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) return process.env.CLOUDFLARE_ACCOUNT_ID;
  var accounts = await request("GET", "/client/v4/accounts?per_page=50");
  if (!accounts || !accounts.length) throw new Error("No Cloudflare accounts on this token");
  if (accounts.length === 1) return accounts[0].id;
  var withPages = [];
  for (var i = 0; i < accounts.length; i++) {
    try {
      await request(
        "GET",
        "/client/v4/accounts/" + accounts[i].id + "/pages/projects/" + PROJECT
      );
      withPages.push(accounts[i]);
    } catch (e) {
      /* not this account */
    }
  }
  if (withPages.length === 1) return withPages[0].id;
  throw new Error(
    "Set CLOUDFLARE_ACCOUNT_ID. Accounts: " +
      accounts.map(function (a) {
        return a.name + " (" + a.id + ")";
      }).join(", ")
  );
}

async function ensureDomain(account, name) {
  var listed = await request(
    "GET",
    "/client/v4/accounts/" + account + "/pages/projects/" + PROJECT + "/domains"
  );
  var already = (listed || []).some(function (d) {
    return d.name === name;
  });
  if (already) {
    console.log("Pages domain already attached:", name);
    return;
  }
  var created = await request(
    "POST",
    "/client/v4/accounts/" + account + "/pages/projects/" + PROJECT + "/domains",
    { name: name }
  );
  console.log("Attached Pages domain:", name, created && created.status);
}

async function ensureCname(zoneId, name) {
  var records = await request(
    "GET",
    "/client/v4/zones/" +
      zoneId +
      "/dns_records?type=CNAME&name=" +
      encodeURIComponent(name)
  );
  var match = (records || []).find(function (r) {
    return r.name === name && r.type === "CNAME";
  });
  if (match) {
    var target = String(match.content || "").replace(/\.$/, "");
    if (target === CNAME_TARGET && match.proxied) {
      console.log("DNS CNAME already in place:", name, "→", CNAME_TARGET);
      return;
    }
    await request("PATCH", "/client/v4/zones/" + zoneId + "/dns_records/" + match.id, {
      type: "CNAME",
      name: name,
      content: CNAME_TARGET,
      proxied: true,
      ttl: 1,
    });
    console.log("Updated DNS CNAME:", name, "→", CNAME_TARGET, "(proxied)");
    return;
  }
  await request("POST", "/client/v4/zones/" + zoneId + "/dns_records", {
    type: "CNAME",
    name: name,
    content: CNAME_TARGET,
    proxied: true,
    ttl: 1,
  });
  console.log("Created DNS CNAME:", name, "→", CNAME_TARGET, "(proxied)");
}

async function waitActive(account, name) {
  for (var i = 0; i < 24; i++) {
    var d = await request(
      "GET",
      "/client/v4/accounts/" +
        account +
        "/pages/projects/" +
        PROJECT +
        "/domains/" +
        name
    );
    console.log("Domain status", name, d.status, d.verification_data || d.validation_data);
    if (d.status === "active") return;
    await sleep(10000);
  }
  console.log("Still waiting on SSL/activation for", name, "(Cloudflare will finish in the background)");
}

async function main() {
  if (!TOKEN) {
    throw new Error("CLOUDFLARE_API_TOKEN is not set");
  }
  var account = await accountId();
  console.log("Account", account);
  var project = await request(
    "GET",
    "/client/v4/accounts/" + account + "/pages/projects/" + PROJECT
  );
  console.log("Pages project", project.name, "subdomain", project.subdomain);
  for (var i = 0; i < DOMAINS.length; i++) {
    await ensureDomain(account, DOMAINS[i]);
  }
  var zones = await request(
    "GET",
    "/client/v4/zones?name=" + encodeURIComponent(ZONE_NAME)
  );
  if (!zones || !zones.length) {
    throw new Error("Zone " + ZONE_NAME + " not found on this account");
  }
  var zoneId = zones[0].id;
  console.log("Zone", ZONE_NAME, zoneId);
  await ensureCname(zoneId, "sourcedcalc.com");
  await ensureCname(zoneId, "www.sourcedcalc.com");
  for (var j = 0; j < DOMAINS.length; j++) {
    await waitActive(account, DOMAINS[j]);
  }
}

main().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
