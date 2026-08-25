/**
 * Host-level 301s. Cloudflare Pages `_redirects` cannot match on hostname
 * (domain-level redirects are unsupported), so a path rule would also fire on
 * sourcedcalc.com. SITE_URL env is not interpolated into static HTML.
 *
 * Preview deployments (*.quickmeasure-a3q.pages.dev) are left alone.
 * Keep hosts in sync with scripts/public-host.js.
 */
var PUBLIC_HOST = "sourcedcalc.com";
var PAGES_DEV_HOST = "quickmeasure-a3q.pages.dev";
var WWW_HOST = "www.sourcedcalc.com";

export async function onRequest(context) {
  var url = new URL(context.request.url);
  if (url.hostname !== PAGES_DEV_HOST && url.hostname !== WWW_HOST) {
    return context.next();
  }
  url.protocol = "https:";
  url.hostname = PUBLIC_HOST;
  url.port = "";
  return Response.redirect(url.toString(), 301);
}
