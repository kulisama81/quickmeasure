/**
 * Host-level 301s. Cloudflare Pages `_redirects` cannot match on hostname
 * (domain-level redirects are unsupported), so a path rule would also fire on
 * sourcedcalc.com. SITE_URL env is not interpolated into static HTML.
 *
 * www.sourcedcalc.com and production quickmeasure-a3q.pages.dev →
 * https://sourcedcalc.com + same path and query.
 * Preview hosts stay untouched.
 * Keep hosts in sync with scripts/public-host.js.
 */
var PUBLIC_HOST = "sourcedcalc.com";
var WWW_HOST = "www.sourcedcalc.com";
var PAGES_DEV_HOST = "quickmeasure-a3q.pages.dev";
var REDIRECT_HOSTS = [WWW_HOST, PAGES_DEV_HOST];

export async function onRequest(context) {
  var url = new URL(context.request.url);
  if (REDIRECT_HOSTS.indexOf(url.hostname) === -1) {
    return context.next();
  }
  url.protocol = "https:";
  url.hostname = PUBLIC_HOST;
  url.port = "";
  return Response.redirect(url.toString(), 301);
}
