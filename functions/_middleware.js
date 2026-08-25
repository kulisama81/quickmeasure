/**
 * Host-level 301s. Cloudflare Pages `_redirects` cannot match on hostname
 * (domain-level redirects are unsupported), so a path rule would also fire on
 * sourcedcalc.com. SITE_URL env is not interpolated into static HTML.
 *
 * www.sourcedcalc.com → https://sourcedcalc.com + same path.
 * Production quickmeasure-a3q.pages.dev is intentionally not redirected until
 * Product customer-passes the custom domain. Preview hosts stay untouched.
 * Keep hosts in sync with scripts/public-host.js.
 */
var PUBLIC_HOST = "sourcedcalc.com";
var WWW_HOST = "www.sourcedcalc.com";

export async function onRequest(context) {
  var url = new URL(context.request.url);
  if (url.hostname !== WWW_HOST) {
    return context.next();
  }
  url.protocol = "https:";
  url.hostname = PUBLIC_HOST;
  url.port = "";
  return Response.redirect(url.toString(), 301);
}
