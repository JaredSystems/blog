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
  delete process.env.MAXMIND_ACCOUNT_ID; delete process.env.MAXMIND_LICENSE_KEY;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://geolite.info/")) {
      geoCalls++;
      assert.equal(options.headers.authorization, `Basic ${Buffer.from("test-account:test-license").toString("base64")}`);
      return new Response(JSON.stringify(geoResult), { status: geoStatus });
    }
    assert.equal(String(url), storeUrl, "Tests must never send production or third-party requests");
    return realFetch(url, options);
  };
  const modulePath = join(temporary, "traffic.mjs");
  await build({ stdin: { contents: `export * from './src/lib/traffic.ts'; export * from './src/lib/traffic-store.ts'; export * from './src/lib/traffic-geo.ts'; export { POST } from './src/pages/api/traffic.ts';`, resolveDir: process.cwd() }, bundle: true, platform: "node", format: "esm", outfile: modulePath, define: { "import.meta.env.PROD": "true" } });
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
  assert.equal((await post(payload())).status, 204);
  assert.equal((await post(payload())).status, 204);
  assert.equal(geoCalls, 1, "GeoLite result should be cached");
  events = await api.readEvents(0, Date.now() + 1000);
  const enriched = events.find(e => e.geoStatus === "geolite");
  assert.equal(enriched.location.city, "The Hammocks");
  assert.equal(enriched.location.accuracyKm, 20);
  assert.equal(enriched.vercelLocation.city, "Miami");
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
  delete process.env.MAXMIND_ACCOUNT_ID; delete process.env.MAXMIND_LICENSE_KEY;
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
  response = await realFetch(`${renderedUrl}?session=${visit.session}`, { headers: { cookie: cookies } });
  html = await response.text();
  assert.ok(html.includes("Session timeline"));
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
