import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { randomUUID, webcrypto } from "node:crypto";
import vm from "node:vm";
import { build } from "esbuild";

const exec = promisify(execFile);
const temporary = await mkdtemp(join(tmpdir(), "jared-traffic-test-"));
const container = `jared-traffic-test-${process.pid}`;
let bridge;
let renderedServer;
const realFetch = globalThis.fetch;
const secret = "test-access-key-".repeat(5);
const origin = "https://www.jaredsystems.com";
let redisRequests = 0;
let storageFailure = false;
let geoCalls = 0;
const geoUrls = [];
let geoResult = { city: { names: { en: "The Hammocks" } }, country: { iso_code: "US" }, subdivisions: [{ iso_code: "FL" }], postal: { code: "33196" }, location: { accuracy_radius: 20 } };
let geoStatus = 200;

try {
  execFileSync("docker", ["run", "--rm", "-d", "--network", "none", "--name", container, "redis:7-alpine", "redis-server", "--save", "", "--appendonly", "no"], { stdio: "pipe" });
  const command = async args => {
    const { stdout } = await exec("docker", ["exec", container, "redis-cli", "--json", ...args.map(String)], { maxBuffer: 16 * 1024 * 1024 });
    const result = JSON.parse(stdout);
    if (typeof result === "object" && result?.error) throw new Error(result.error);
    return result;
  };
  bridge = createServer(async (request, response) => {
    redisRequests++;
    if (storageFailure) { response.writeHead(503).end(); return; }
    try {
      assert.equal(request.headers.authorization, "Bearer test-only-token");
      let body = ""; for await (const part of request) body += part;
      const result = await command(JSON.parse(body));
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ result }));
    } catch (error) { response.writeHead(200).end(JSON.stringify({ error: String(error) })); }
  });
  await new Promise(resolve => bridge.listen(0, "127.0.0.1", resolve));
  const storeUrl = `http://127.0.0.1:${bridge.address().port}`;
  Object.assign(process.env, { KV_REST_API_URL: storeUrl, KV_REST_API_TOKEN: "test-only-token", ANALYTICS_SECRET: secret, TRAFFIC_ENABLED: "true", VERCEL_ENV: "production" });
  delete process.env.MAXMIND_ACCOUNT_ID; delete process.env.MAXMIND_LICENSE_KEY; delete process.env.MAXMIND_ENABLED;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://geolite.info/")) {
      geoCalls++;
      geoUrls.push(String(url));
      assert.equal(options.headers.authorization, `Basic ${Buffer.from("test-account:test-license").toString("base64")}`);
      return new Response(JSON.stringify(geoResult), { status: geoStatus });
    }
    assert.equal(String(url), storeUrl, "Tests must never send production or third-party requests");
    return realFetch(url, options);
  };
  const modulePath = join(temporary, "traffic.mjs");
  await build({ stdin: { contents: `export * from './src/lib/traffic.ts'; export * from './src/lib/traffic-store.ts'; export * from './src/lib/traffic-geo.ts'; export * from './src/lib/traffic-location.ts'; export { POST } from './src/pages/api/traffic.ts';`, resolveDir: process.cwd() }, bundle: true, platform: "node", format: "esm", outfile: modulePath, define: { "import.meta.env.PROD": "true" } });
  const api = await import(pathToFileURL(modulePath));
  const payload = changes => ({ id: randomUUID(), session: randomUUID(), timestamp: Date.now(), type: "pageview", path: "/", title: "Test", referrer: "https://google.com/search?q=private", ...changes });
  const request = (body, headers = {}, url = `${origin}/api/traffic`) => new Request(url, { method: "POST", headers: { origin, "content-type": "application/json", "user-agent": "Mozilla/5.0 Chrome/130", "x-forwarded-for": "192.0.2.25", "x-vercel-ip-city": "Miami", "x-vercel-ip-country-region": "FL", "x-vercel-ip-country": "US", "x-vercel-ip-postal-code": "33101", ...headers }, body: JSON.stringify(body) });
  const post = async (...args) => api.POST({ request: request(...args) });

  const beforeGuards = redisRequests;
  for (const environment of ["development", "preview", ""]) {
    process.env.VERCEL_ENV = environment;
    assert.equal((await post(payload())).status, 404);
  }
  process.env.VERCEL_ENV = "production";
  process.env.TRAFFIC_ENABLED = "false";
  assert.equal((await post(payload())).status, 404);
  process.env.TRAFFIC_ENABLED = "true";
  for (const url of ["http://www.jaredsystems.com/api/traffic", "https://www.jaredsystems.com:444/api/traffic", "https://preview.vercel.app/api/traffic", "https://jaredsystems.com.evil.test/api/traffic"]) {
    assert.equal((await post(payload(), {}, url)).status, 404);
  }
  assert.equal(api.productionRequest(request(payload()), false), false);
  assert.equal((await post(payload(), { origin: "https://other.test" })).status, 403);
  for (const headers of [{ dnt: "1" }, { "sec-gpc": "1" }, { "user-agent": "Googlebot" }, { cookie: "traffic_ignore=1" }]) assert.equal((await post(payload(), headers)).status, 204);
  assert.equal((await post(payload({ path: "/private/traffic" }))).status, 400);
  assert.equal((await post(payload({ path: "/?key=secret" }))).status, 400);
  assert.equal((await post(payload({ timestamp: Date.now() - 90000000 }))).status, 400);
  assert.equal((await post(payload({ title: "x".repeat(9000) }))).status, 400);
  assert.equal((await post(payload(), { "content-type": "text/plain" })).status, 415);
  assert.equal(redisRequests, beforeGuards, "Rejected/ignored requests must not touch Redis");
  console.log("PASS: production/host/origin gates, privacy signals, and payload validation");

  const token = api.adminToken();
  const adminRequest = new Request(origin, { headers: { cookie: `${api.ADMIN_COOKIE}=${token}` } });
  assert.equal(api.authorized(adminRequest), true);
  assert.equal(api.authorized(adminRequest, Date.now() + 90000000), false);
  assert.equal(api.authorized(new Request(origin, { headers: { cookie: `${api.ADMIN_COOKIE}=${token.slice(0, -1)}x` } })), false);
  assert.equal((await post(payload(), { cookie: `${api.ADMIN_COOKIE}=${token}` })).status, 204);
  assert.equal(api.validSecret(secret), true);
  assert.equal(api.validSecret("wrong"), false);

  const visit = payload();
  const click = payload({ session: visit.session, type: "outbound", target: "https://marmotsystems.com/?secret=hidden#fragment" });
  assert.equal((await post(visit)).status, 204);
  assert.equal((await post(click)).status, 204);
  assert.equal((await post(visit)).status, 204);
  let events = await api.readEvents(0, Date.now() + 1000);
  assert.equal(events.length, 2);
  assert.equal(new Set(events.map(e => e.session)).size, 1);
  assert.equal(events.find(e => e.type === "outbound").target, "https://marmotsystems.com/");
  assert.equal(events[0].source, "google.com");
  assert.equal(events[0].medium, "organic");
  assert.equal(events[0].referrer, "https://google.com/search");
  assert.equal(events[0].location.city, "Miami");
  assert.equal(events[0].location.postal, "33101");
  assert.ok(!JSON.stringify(events).includes("192.0.2.25"));
  assert.equal((await api.readHealth()).count, 2);
  assert.ok((await api.readHealth()).lastWrite, "Redis health includes the last successful write");
  const ttl = await command(["TTL", `${api.TRAFFIC_PREFIX}:event:${visit.id}`]);
  assert.ok(ttl <= api.RETENTION_SECONDS && ttl > api.RETENTION_SECONDS - 30);
  console.log("PASS: real Redis persistence, session grouping, redaction, deduplication, and event expiry");

  const retried = payload();
  storageFailure = true;
  assert.equal((await post(retried)).status, 503);
  storageFailure = false;
  assert.equal((await post(retried)).status, 204);
  assert.equal((await post(retried)).status, 204);
  assert.equal((await api.readHealth()).count, 3);
  const rateKey = `rate:${api.privateHash(`${new Date().toISOString().slice(0, 10)}:192.0.2.25`)}`;
  await command(["SET", `${api.TRAFFIC_PREFIX}:${rateKey}`, 120, "EX", 60]);
  assert.equal((await post(payload())).status, 429);
  await command(["DEL", `${api.TRAFFIC_PREFIX}:${rateKey}`]);
  console.log("PASS: storage outage retry and request rate limiting");

  process.env.MAXMIND_ACCOUNT_ID = "test-account"; process.env.MAXMIND_LICENSE_KEY = "test-license";
  const disabledRequest = request(payload(), { "x-vercel-ip-postal-code": "33196" });
  const beforeDisabled = redisRequests;
  for (const setting of [undefined, "false", "TRUE", "1"]) {
    if (setting === undefined) delete process.env.MAXMIND_ENABLED;
    else process.env.MAXMIND_ENABLED = setting;
    assert.equal(api.geoLiteEnabled(), false);
    assert.equal((await api.locate(disabledRequest)).location.postal, "33196");
  }
  assert.equal(redisRequests, beforeDisabled, "Disabled GeoLite must not access its cache or quota");
  assert.equal(geoCalls, 0, "Configured credentials must not enable GeoLite or send visitor IPs");
  delete process.env.MAXMIND_ENABLED;
  const disabledVisit = payload();
  assert.equal((await post(disabledVisit, { "x-vercel-ip-postal-code": "33196" })).status, 204);
  const disabledEvent = (await api.readEvents(0, Date.now() + 1000)).find(e => e.id === disabledVisit.id);
  assert.equal(disabledEvent.location.provider, "Vercel");
  assert.equal(disabledEvent.location.postal, "33196");
  assert.equal(disabledEvent.geoStatus, "vercel");
  assert.equal(geoCalls, 0);
  assert.equal(api.approximateArea(disabledEvent.location), "The Hammocks / West Kendall");
  assert.equal(api.approximateArea({ ...disabledEvent.location, postal: " 33196-1234 " }), "The Hammocks / West Kendall");
  for (const change of [{ country: "CA" }, { region: "NY" }, { country: "" }, { region: "" }, { postal: "331960" }, { postal: "33196abc" }, { postal: "33064" }, { postal: "" }]) {
    assert.equal(api.approximateArea({ ...disabledEvent.location, ...change }), null, "Unknown, invalid, and foreign locations must not acquire an area label");
  }
  console.log("PASS: GeoLite defaults off despite credentials; ZIP labels require a known US/FL ZIP");
  process.env.MAXMIND_ENABLED = "true";
  assert.equal((await post(payload())).status, 204);
  assert.equal((await post(payload())).status, 204);
  assert.equal(geoCalls, 1, "GeoLite result should be cached");
  events = await api.readEvents(0, Date.now() + 1000);
  const enriched = events.find(e => e.geoStatus === "geolite");
  assert.equal(enriched.location.city, "The Hammocks");
  assert.equal(enriched.location.accuracyKm, 20);
  assert.equal(enriched.vercelLocation.city, "Miami");
  // Reproduce the reported visit through the real collector, then render that
  // same saved event below. Neither provider is known to be correct from IP alone.
  geoResult = { city: { names: { en: "Pompano Beach" } }, country: { iso_code: "US" }, subdivisions: [{ iso_code: "FL" }], postal: { code: "33064" }, location: { accuracy_radius: 50 } };
  const conflictingVisit = payload();
  assert.equal((await post(conflictingVisit, { "x-forwarded-for": "192.0.2.29", "x-vercel-ip-postal-code": "33196" })).status, 204);
  assert.equal(geoUrls.at(-1), "https://geolite.info/geoip/v2.1/city/192.0.2.29", "Lookup must use this visitor's IP, not the server or previous visitor");
  const conflictingEvent = (await api.readEvents(0, Date.now() + 1000)).find(e => e.id === conflictingVisit.id);
  assert.equal(conflictingEvent.location.city, "Pompano Beach");
  assert.equal(conflictingEvent.location.postal, "33064");
  assert.equal(conflictingEvent.vercelLocation.postal, "33196");
  process.env.MAXMIND_ENABLED = "false";
  const beforeCachedDisabled = { redis: redisRequests, geo: geoCalls };
  const disabledCached = await api.locate(request(payload(), { "x-forwarded-for": "192.0.2.29", "x-vercel-ip-postal-code": "33196" }));
  assert.equal(disabledCached.location.provider, "Vercel");
  assert.equal(disabledCached.location.postal, "33196");
  assert.deepEqual({ redis: redisRequests, geo: geoCalls }, beforeCachedDisabled, "Disabling GeoLite must bypass previously cached results too");
  process.env.MAXMIND_ENABLED = "true";
  geoStatus = 429;
  const fallbackId = randomUUID();
  assert.equal((await post(payload({ id: fallbackId }), { "x-forwarded-for": "192.0.2.26" })).status, 204);
  const fallback = (await api.readEvents(0, Date.now() + 1000)).find(e => e.id === fallbackId);
  assert.equal(fallback.geoStatus, "fallback"); assert.equal(fallback.location.provider, "Vercel");
  geoStatus = 200; geoResult = { country: { iso_code: "US" } };
  const noCity = await api.locate(request(payload(), { "x-forwarded-for": "192.0.2.27" }));
  assert.equal(noCity.geoStatus, "fallback");
  await command(["SET", `${api.TRAFFIC_PREFIX}:geo-quota:${new Date().toISOString().slice(0, 10)}`, 900, "EX", 100]);
  const callsBeforeQuota = geoCalls;
  assert.equal((await api.locate(request(payload(), { "x-forwarded-for": "192.0.2.28" }))).geoStatus, "fallback");
  assert.equal(geoCalls, callsBeforeQuota);
  console.log("PASS: free GeoLite enrichment/cache, independent provider estimates, quota and failure fallback");

  // Exercise the actual Lua script with a small capacity, in separate test keys.
  for (let i = 1; i <= 3; i++) await command(["EVAL", api.SAVE_EVENT_SCRIPT, 4, "cap:events", `cap:seen:${i}`, "cap:health", `cap:event:${i}`, i, JSON.stringify({ id: i }), 60, 0, 2, "now", String(i), "cap:event:"]);
  assert.equal(await command(["ZCARD", "cap:events"]), 2);
  assert.equal(await command(["EXISTS", "cap:event:1"]), 0);
  assert.equal(await command(["HGET", "cap:health", "capacityRemoved"]), "1");
  assert.deepEqual(await command(["ZRANGE", "cap:events", 0, -1]), ["2", "3"]);
  await command(["LPUSH", "blog:analytics:visits", JSON.stringify({ id: randomUUID(), timestamp: new Date().toISOString(), path: "/old", city: "Miami", country: "US" })]);
  const legacy = await api.readLegacy();
  assert.equal(legacy[0].path, "/old"); assert.equal(legacy[0].session, ""); assert.equal(legacy[0].location.postal, "");
  console.log("PASS: capacity eviction deletes event data; legacy archive stays separate");

  // test:analytics builds this real Astro/Vercel entrypoint. Exercise the rendered
  // page too: helper tests alone cannot catch lost headers on Astro redirects.
  // Keep test credentials configured; exercise explicit re-enablement first,
  // then the default-off production behavior on the same historical records.
  const { default: handler } = await import(pathToFileURL(join(process.cwd(), ".vercel/output/functions/_render.func/dist/server/entry.mjs")));
  renderedServer = createServer(async (req, res) => {
    req.headers.host = "www.jaredsystems.com";
    req.headers["x-forwarded-proto"] = "https";
    try { await handler(req, res); } catch { res.statusCode = 500; res.end(); }
  });
  await new Promise(resolve => renderedServer.listen(0, "127.0.0.1", resolve));
  const renderedUrl = `http://127.0.0.1:${renderedServer.address().port}/private/traffic`;
  let response = await realFetch(renderedUrl);
  let html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes("Open your private dashboard"));
  assert.ok(!html.includes("data-google-analytics") && !html.includes("data-private-traffic"));
  response = await realFetch(`${renderedUrl}?key=${secret}`, { redirect: "manual" });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/private/traffic");
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("referrer-policy"), "same-origin");
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /Secure/);
  response = await realFetch(renderedUrl, { method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ key: secret }), redirect: "manual" });
  assert.equal(response.status, 303);
  const cookies = response.headers.getSetCookie().map(cookie => cookie.split(";")[0]).join("; ");
  await api.saveEvent({ ...events[0], id: randomUUID(), title: "<script>alert(1)</script>" });
  response = await realFetch(renderedUrl, { headers: { cookie: cookies } });
  html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes("Storage connected"));
  assert.ok(!html.includes("Last stored event: None yet"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!html.includes("<script>alert(1)</script>"));
  response = await realFetch(`${renderedUrl}?session=${conflictingVisit.session}`, { headers: { cookie: cookies } });
  html = await response.text();
  const locationCell = html.match(/<td\b[^>]*>[\s\S]*?<\/td>/g)?.find(cell => cell.includes("Pompano Beach"));
  assert.ok(locationCell?.includes("33196") && locationCell.includes("33064"), "Both provider ZIP estimates must remain visible on the same visit");
  assert.ok(!locationCell.includes("<details"), "The potentially correct Vercel estimate must not be hidden behind a disclosure");
  assert.match(locationCell, /Providers disagree: city, ZIP/, "Conflicting provider estimates must be flagged instead of implying MaxMind is more accurate");
  assert.ok(locationCell.indexOf("Miami") < locationCell.indexOf("Pompano Beach"), "Show the built-in Vercel estimate before the optional GeoLite comparison");
  assert.ok(locationCell.includes("50 km"), "Keep MaxMind's reported uncertainty visible");
  console.log("PASS: reported Miami 33196 / Pompano Beach 33064 conflict is visible and flagged on the saved visit");
  for (const comparison of [
    { ...conflictingEvent.vercelLocation, city: "miami", provider: "MaxMind GeoLite", accuracyKm: 50 },
    { ...conflictingEvent.vercelLocation, postal: "", provider: "MaxMind GeoLite", accuracyKm: null },
  ]) {
    const session = randomUUID();
    await api.saveEvent({ ...conflictingEvent, id: randomUUID(), session, location: comparison });
    const comparisonHtml = await (await realFetch(`${renderedUrl}?session=${session}`, { headers: { cookie: cookies } })).text();
    assert.ok(!comparisonHtml.includes("Providers disagree:"), "Case differences and missing fields must not be reported as disagreements");
    assert.ok(comparisonHtml.includes("Vercel estimate") && comparisonHtml.includes("MaxMind GeoLite estimate"));
    if (!comparison.postal) assert.ok(comparisonHtml.includes("Estimated ZIP: Unknown"), "Do not borrow the other provider's ZIP");
  }
  delete process.env.MAXMIND_ENABLED;
  for (const recordedVisit of [disabledVisit, conflictingVisit]) {
    html = await (await realFetch(`${renderedUrl}?session=${recordedVisit.session}`, { headers: { cookie: cookies } })).text();
    const areaCell = html.match(/<td\b[^>]*>[\s\S]*?<\/td>/g)?.find(cell => cell.includes("Approximate area"));
    assert.ok(areaCell?.includes("The Hammocks / West Kendall"));
    assert.ok(areaCell.includes("Miami, FL, US") && areaCell.includes("Estimated ZIP: 33196"), "Keep the original Vercel city and ZIP");
    assert.ok(areaCell.includes("Inferred from ZIP 33196; neighborhood not confirmed."));
    assert.ok(!html.includes("Pompano Beach") && !html.includes("33064") && !html.includes("MaxMind GeoLite estimate") && !html.includes("Providers disagree:"), "Disabled estimates must disappear from both new and historical visits");
    assert.ok(html.includes("MaxMind lookups and estimates are disabled."));
  }
  for (const query of ["hammocks", "west kendall", "33196", "miami"]) {
    html = await (await realFetch(`${renderedUrl}?session=${conflictingVisit.session}&q=${encodeURIComponent(query)}`, { headers: { cookie: cookies } })).text();
    assert.ok(html.includes("1 matching events"), "Area, city, and ZIP searches must match the visible Vercel estimate");
  }
  for (const query of ["Pompano Beach", "33064"]) {
    html = await (await realFetch(`${renderedUrl}?session=${conflictingVisit.session}&q=${encodeURIComponent(query)}`, { headers: { cookie: cookies } })).text();
    assert.ok(html.includes("No matching activity"), "Hidden GeoLite values must not produce misleading search results");
  }
  const missingVercelSession = randomUUID();
  await api.saveEvent({ ...conflictingEvent, id: randomUUID(), session: missingVercelSession, vercelLocation: undefined });
  html = await (await realFetch(`${renderedUrl}?session=${missingVercelSession}`, { headers: { cookie: cookies } })).text();
  assert.ok(html.includes("Estimated ZIP: Unknown") && !html.includes("Approximate area</small>"));
  assert.ok(!html.includes("Pompano Beach"), "Do not use an old GeoLite estimate when the Vercel copy is absent");
  assert.equal((await api.readEvents(0, Date.now() + 1000)).find(e => e.id === conflictingVisit.id).location.postal, "33064", "Historical raw estimates remain unchanged");
  console.log("PASS: ZIP area labels, Vercel-only history, disabled GeoLite display/search, and missing estimates");
  response = await realFetch(`${renderedUrl}?session=${visit.session}`, { headers: { cookie: cookies } });
  html = await response.text();
  assert.ok(html.includes("Session timeline"));
  assert.ok(html.includes("Vercel estimate") && !html.includes("MaxMind GeoLite estimate"), "Vercel-only records must not invent a comparison");
  response = await realFetch(`${renderedUrl}?q=does-not-exist-anywhere`, { headers: { cookie: cookies } });
  assert.ok((await response.text()).includes("No matching activity"));
  storageFailure = true;
  response = await realFetch(renderedUrl, { headers: { cookie: cookies } });
  assert.equal(response.status, 503);
  assert.ok((await response.text()).includes("Storage needs attention"));
  storageFailure = false;
  response = await realFetch(renderedUrl, { method: "POST", headers: { cookie: cookies, origin, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ action: "logout" }), redirect: "manual" });
  assert.equal(response.status, 303);
  const deletion = response.headers.getSetCookie().find(cookie => cookie.startsWith(`${api.ADMIN_COOKIE}=`));
  assert.match(deletion, /Secure/, "Browsers reject __Host- deletion cookies without Secure");
  assert.match(deletion, /(?:Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
  console.log("PASS: actual rendered login, cookies, redirect privacy headers, escaping, filters, sessions and storage error state");

  const script = await readFile("public/traffic.js", "utf8");
  const browser = ({ url = origin, dnt, gpc, cookie = "", saved = new Map(), status = 204, beacon = true } = {}) => {
    const calls = []; const timers = []; const listeners = {}; const windowListeners = {};
    class Element { constructor(href) { this.href = href; } closest() { return this; } }
    const window = { location: new URL(url), crypto: webcrypto, addEventListener: (name, fn) => { windowListeners[name] = fn; } };
    const document = { title: "Test page", referrer: "https://google.com/", cookie, addEventListener: (name, fn) => { listeners[name] = fn; } };
    const navigator = { doNotTrack: dnt, globalPrivacyControl: gpc, onLine: true, sendBeacon: (...args) => { calls.push({ beacon: args }); return beacon; } };
    vm.runInNewContext(script, { window, document, navigator, crypto: webcrypto, URL, URLSearchParams, Blob, Element, Date,
      sessionStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
      setTimeout: fn => timers.push(fn), fetch: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return { ok: status >= 200 && status < 300, status }; } });
    return { calls, timers, listeners, windowListeners, Element, saved };
  };
  for (const options of [{ url: "http://localhost:4321/" }, { url: "https://preview.vercel.app/" }, { url: "http://www.jaredsystems.com/" }, { url: "https://www.jaredsystems.com:444/" }, { url: `${origin}/private/traffic` }, { dnt: "1" }, { gpc: true }, { cookie: "traffic_ignore=1" }]) assert.equal(browser(options).calls.length, 0);
  const b = browser();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.calls.length, 1);
  b.listeners.auxclick({ type: "auxclick", button: 1, target: new b.Element("https://marmotsystems.com/?token=private") });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(b.calls[1].body.type, "outbound");
  assert.equal(b.calls[1].body.target, "https://marmotsystems.com/");
  assert.equal(b.calls[0].body.session, b.calls[1].body.session);
  const nextPage = browser({ url: `${origin}/books`, saved: b.saved });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(nextPage.calls[0].body.session, b.calls[0].body.session);
  const failed = browser({ status: 503, beacon: false });
  await new Promise(resolve => setImmediate(resolve));
  failed.windowListeners.pagehide();
  await new Promise(resolve => setImmediate(resolve));
  const sends = failed.calls.filter(call => call.body);
  assert.equal(sends.length, 2, "Rejected beacon uses fetch fallback");
  assert.equal(sends[0].body.id, sends[1].body.id, "Retries keep the event ID");
  const resumed = browser({ saved: failed.saved });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(resumed.calls.some(call => call.body?.id === sends[0].body.id), "Navigation retries the prior pending event");
  console.log("PASS: browser exclusion, middle-click capture, session continuity, beacon fallback, and navigation retry");
} finally {
  globalThis.fetch = realFetch;
  if (renderedServer) await new Promise(resolve => renderedServer.close(resolve));
  if (bridge) await new Promise(resolve => bridge.close(resolve));
  try { execFileSync("docker", ["stop", container], { stdio: "pipe" }); } catch { /* Already stopped or never started. */ }
  await rm(temporary, { recursive: true, force: true });
}
