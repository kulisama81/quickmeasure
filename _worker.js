/**
 * Pages Advanced Mode entry. Same host 301s as functions/_middleware.js.
 * Lives at the static root so `wrangler pages deploy .` still compiles it
 * when `.assetsignore` excludes `functions/`.
 *
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

function maybeCanonicalRedirect(request) {
  var url = new URL(request.url);
  if (REDIRECT_HOSTS.indexOf(url.hostname) === -1) {
    return null;
  }
  url.protocol = "https:";
  url.hostname = PUBLIC_HOST;
  url.port = "";
  return Response.redirect(url.toString(), 301);
}

export async function onRequest(context) {
  return maybeCanonicalRedirect(context.request) || context.next();
}

export default {
  async fetch(request, env) {
    var redirected = maybeCanonicalRedirect(request);
    if (redirected) return redirected;
    return env.ASSETS.fetch(request);
  },
};
