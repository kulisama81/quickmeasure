/**
 * Public host for Sourced Calc.
 * Static HTML (sitemap, robots, canonicals) hardcodes this origin — there is
 * no build step to interpolate SITE_URL. Keep hosts in sync with
 * functions/_middleware.js.
 *
 * Production quickmeasure-a3q.pages.dev 301s to sourcedcalc.com (same path
 * and query). Preview hosts stay untouched.
 */
var PUBLIC_HOST = "sourcedcalc.com";
var PUBLIC_ORIGIN = "https://sourcedcalc.com";
var PAGES_DEV_HOST = "quickmeasure-a3q.pages.dev";
var WWW_HOST = "www.sourcedcalc.com";
var REDIRECT_HOSTS = [WWW_HOST, PAGES_DEV_HOST];

function canonicalRedirect(urlString) {
  var url = new URL(urlString);
  if (REDIRECT_HOSTS.indexOf(url.hostname) === -1) return null;
  var dest = new URL(urlString);
  dest.protocol = "https:";
  dest.hostname = PUBLIC_HOST;
  dest.port = "";
  return dest.toString();
}

module.exports = {
  PUBLIC_HOST: PUBLIC_HOST,
  PUBLIC_ORIGIN: PUBLIC_ORIGIN,
  PAGES_DEV_HOST: PAGES_DEV_HOST,
  WWW_HOST: WWW_HOST,
  REDIRECT_HOSTS: REDIRECT_HOSTS,
  canonicalRedirect: canonicalRedirect,
};
