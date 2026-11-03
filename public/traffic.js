(() => {
  const location = window.location;
  if (location.protocol !== "https:" || location.port !== "" ||
    !["jaredsystems.com", "www.jaredsystems.com"].includes(location.hostname) ||
    /^\/(private|api)(\/|$)/i.test(location.pathname) ||
    navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.globalPrivacyControl === true ||
    /(?:^|;\s*)traffic_ignore=1(?:;|$)/.test(document.cookie) || !window.crypto?.randomUUID || window.__privateTraffic) return;
  window.__privateTraffic = true;

  const SESSION_KEY = "jared-traffic-session-v2";
  const QUEUE_KEY = "jared-traffic-queue-v2";
  const ENDPOINT = "/api/traffic";
  const MAX_AGE = 86400000;
  const read = (key, fallback) => { try { return JSON.parse(sessionStorage.getItem(key)) || fallback; } catch { return fallback; } };
  const write = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be disabled. Tracking still works in this document. */ } };
  let session = read(SESSION_KEY, null);
  let queue = read(QUEUE_KEY, []);
  if (!Array.isArray(queue)) queue = [];
  queue = queue.filter(item => item?.event && Date.now() - item.event.timestamp < MAX_AGE && item.attempts < 5).slice(-40);
  const busy = new Set();
  const persist = () => write(QUEUE_KEY, queue);
  const forget = id => { queue = queue.filter(item => item.event.id !== id); persist(); };

  function context() {
    const now = Date.now();
    if (!session || typeof session.id !== "string" || !Number.isFinite(session.last) || now - session.last > 1800000) {
      const params = new URLSearchParams(location.search);
      session = { id: crypto.randomUUID(), last: now, referrer: document.referrer,
        source: params.get("utm_source") || "", medium: params.get("utm_medium") || "", campaign: params.get("utm_campaign") || "" };
    }
    session.last = now;
    write(SESSION_KEY, session);
    return { session: session.id, referrer: session.referrer, source: session.source, medium: session.medium, campaign: session.campaign };
  }

  async function deliver(item) {
    if (busy.has(item.event.id) || !queue.includes(item) || navigator.onLine === false || item.attempts >= 5) return;
    busy.add(item.event.id);
    item.attempts += 1;
    persist();
    let retryAfter = Math.min(1000 * 2 ** item.attempts, 30000);
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify(item.event), keepalive: true,
      });
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        forget(item.event.id);
      } else if (response.status === 429) retryAfter = 60000;
    } catch { /* Keep the event queued; a later document can retry the same ID. */ }
    finally { busy.delete(item.event.id); }
    if (queue.includes(item) && item.attempts < 5) setTimeout(() => deliver(item), retryAfter);
  }

  function track(type, target = "") {
    const event = { id: crypto.randomUUID(), timestamp: Date.now(), type, path: location.pathname,
      title: document.title, target, ...context() };
    queue.push({ event, attempts: 0 });
    queue = queue.slice(-40);
    persist();
    deliver(queue[queue.length - 1]);
  }

  // A page transition may interrupt the response after the server saved an
  // event. Persistent IDs and server deduplication make retrying safe.
  queue.forEach(deliver);
  track("pageview");
  const click = event => {
    if (event.type === "auxclick" && event.button !== 1) return;
    if (event.type === "click" && event.button !== 0 && event.button !== undefined) return;
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!link) return;
    try {
      const url = new URL(link.href, location.href);
      if (!["http:", "https:"].includes(url.protocol) || ["jaredsystems.com", "www.jaredsystems.com"].includes(url.hostname)) return;
      track("outbound", `${url.origin}${url.pathname}`);
    } catch { /* Invalid and non-web links are not navigation events. */ }
  };
  document.addEventListener("click", click, { capture: true });
  document.addEventListener("auxclick", click, { capture: true });
  window.addEventListener("online", () => queue.forEach(deliver));
  window.addEventListener("pagehide", () => {
    for (const item of queue) {
      if (item.attempts >= 5) continue;
      try {
        const accepted = navigator.sendBeacon?.(ENDPOINT, new Blob([JSON.stringify(item.event)], { type: "application/json" }));
        if (!accepted) deliver(item);
      } catch { deliver(item); }
    }
  });
  // Returning from the back/forward cache is another page view.
  window.addEventListener("pageshow", event => { if (event.persisted) track("pageview"); });
})();
