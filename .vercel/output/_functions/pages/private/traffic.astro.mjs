import { c as createComponent, a as createAstro, r as renderHead, b as addAttribute, e as renderTemplate } from '../../chunks/astro/server_DbS2FUvM.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                                                */
import { b as isAnalyticsAuthorized, g as getVisitEvents, d as getAnalyticsStorageLabel } from '../../chunks/analytics_B5SNUy91.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro();
const prerender = false;
const $$Traffic = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Traffic;
  const noIndexHeaders = {
    "cache-control": "private, no-store",
    "content-type": "text/plain; charset=utf-8",
    "x-robots-tag": "noindex, nofollow"
  };
  Astro2.response.headers.set("cache-control", "private, no-store");
  Astro2.response.headers.set("x-robots-tag", "noindex, nofollow");
  if (!isAnalyticsAuthorized(Astro2.url, Astro2.request)) {
    return new Response("Not found", {
      status: 404,
      headers: noIndexHeaders
    });
  }
  const visits = await getVisitEvents(500);
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1e3;
  const oneWeek = 7 * oneDay;
  const formatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short"
  });
  const within = (visit, windowMs) => now - new Date(visit.timestamp).getTime() <= windowMs;
  const countBy = (rows, getKey, fallback = "Unknown") => {
    const counts = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const key = getKey(row) || fallback;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  };
  const last24 = visits.filter((visit) => within(visit, oneDay)).length;
  const last7 = visits.filter((visit) => within(visit, oneWeek)).length;
  const instagram = visits.filter((visit) => visit.source === "Instagram").length;
  const sources = countBy(visits, (visit) => visit.source);
  const paths = countBy(visits, (visit) => visit.path);
  const countries = countBy(visits, (visit) => visit.country, "Unknown");
  const recent = visits.slice(0, 60);
  const storageLabel = getAnalyticsStorageLabel();
  const refreshHref = `${Astro2.url.pathname}?key=${encodeURIComponent(
    Astro2.url.searchParams.get("key") || ""
  )}`;
  return renderTemplate`<html lang="en"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex, nofollow"><title>Traffic</title>${renderHead()}</head> <body class="traffic-page"> <header class="traffic-header"> <div> <p class="traffic-kicker">private</p> <h1>Traffic</h1> </div> <a${addAttribute(refreshHref, "href")}>refresh</a> </header> <section class="traffic-metrics" aria-label="Traffic totals"> <article> <span>Last 24h</span> <strong>${last24}</strong> </article> <article> <span>Last 7d</span> <strong>${last7}</strong> </article> <article> <span>Instagram</span> <strong>${instagram}</strong> </article> <article> <span>Total stored</span> <strong>${visits.length}</strong> </article> </section> <section class="traffic-meta"> <span>Storage: ${storageLabel}</span> <span>No cookies, IPs, or full user-agent strings stored</span> </section> <section class="traffic-grid"> <div class="traffic-panel"> <h2>Sources</h2> <table> <tbody> ${sources.map(([source, count]) => renderTemplate`<tr> <th>${source}</th> <td>${count}</td> </tr>`)} </tbody> </table> </div> <div class="traffic-panel"> <h2>Pages</h2> <table> <tbody> ${paths.map(([path, count]) => renderTemplate`<tr> <th>${path}</th> <td>${count}</td> </tr>`)} </tbody> </table> </div> <div class="traffic-panel"> <h2>Countries</h2> <table> <tbody> ${countries.map(([country, count]) => renderTemplate`<tr> <th>${country}</th> <td>${count}</td> </tr>`)} </tbody> </table> </div> </section> <section class="traffic-panel traffic-recent"> <h2>Recent Visits</h2> <table> <thead> <tr> <th>Time</th> <th>Source</th> <th>Page</th> <th>Device</th> <th>Browser</th> <th>Locale</th> </tr> </thead> <tbody> ${recent.map((visit) => renderTemplate`<tr> <td>${formatter.format(new Date(visit.timestamp))}</td> <td> <span>${visit.source}</span> ${visit.sourceDetail && renderTemplate`<small>${visit.sourceDetail}</small>`} </td> <td>${visit.path}</td> <td>${visit.device}</td> <td>${visit.browser}</td> <td> <span>${visit.country || "Unknown"}</span> ${visit.language && renderTemplate`<small>${visit.language}</small>`} </td> </tr>`)} </tbody> </table> </section> </body></html>`;
}, "/home/jared/blog/blog/src/pages/private/traffic.astro", void 0);

const $$file = "/home/jared/blog/blog/src/pages/private/traffic.astro";
const $$url = "/private/traffic";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Traffic,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
