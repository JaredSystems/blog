import { timingSafeEqual, randomUUID } from 'node:crypto';
import { readFile, mkdir, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const ANALYTICS_KEY = process.env.ANALYTICS_KV_KEY || "blog:analytics:visits";
const configuredMaxEvents = Number(process.env.ANALYTICS_MAX_EVENTS || 1e3);
const MAX_EVENTS = Number.isFinite(configuredMaxEvents) && configuredMaxEvents > 0 ? configuredMaxEvents : 1e3;
const LOCAL_FILE = join(tmpdir(), "jareds-blog-analytics", "visits.jsonl");
const KNOWN_SOURCES = {
  instagram: "Instagram",
  ig: "Instagram",
  facebook: "Facebook",
  fb: "Facebook",
  linkedin: "LinkedIn",
  twitter: "X",
  x: "X",
  github: "GitHub",
  google: "Google",
  bing: "Bing",
  duckduckgo: "DuckDuckGo",
  newsletter: "Newsletter"
};
function cleanString(value, maxLength = 160) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}
function cleanPath(value) {
  const raw = cleanString(value, 500);
  if (!raw) return "/";
  try {
    const url = new URL(raw, "https://example.local");
    return url.pathname.slice(0, 160) || "/";
  } catch {
    return raw.startsWith("/") ? raw.slice(0, 160) : "/";
  }
}
function cleanReferrer(value, siteOrigin) {
  const raw = cleanString(value, 500);
  if (!raw) {
    return { host: "", path: "" };
  }
  try {
    const url = new URL(raw);
    if (url.origin === siteOrigin) {
      return { host: "", path: "" };
    }
    return {
      host: url.hostname.replace(/^www\./, "").slice(0, 120),
      path: url.pathname.slice(0, 160)
    };
  } catch {
    return { host: "", path: "" };
  }
}
function cleanUtm(value) {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    source: cleanString(record.source, 80).toLowerCase(),
    medium: cleanString(record.medium, 80).toLowerCase(),
    campaign: cleanString(record.campaign, 100),
    content: cleanString(record.content, 100),
    term: cleanString(record.term, 100)
  };
}
function labelFromToken(value) {
  const normalized = value.toLowerCase().replace(/^utm_/, "");
  for (const [token, label] of Object.entries(KNOWN_SOURCES)) {
    if (normalized === token || normalized.includes(token)) return label;
  }
  return value.split(/[-_.\s]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ").slice(0, 60);
}
function sourceFromHost(host) {
  if (!host) return "";
  if (host.includes("instagram.com")) return "Instagram";
  if (host.includes("facebook.com") || host.includes("fb.com")) return "Facebook";
  if (host.includes("linkedin.com")) return "LinkedIn";
  if (host === "t.co" || host.includes("twitter.com") || host === "x.com") return "X";
  if (host.includes("github.com")) return "GitHub";
  if (host.includes("google.")) return "Google";
  if (host.includes("bing.com")) return "Bing";
  if (host.includes("duckduckgo.com")) return "DuckDuckGo";
  return labelFromToken(host.replace(/^m\./, "").split(".")[0]);
}
function detectSource(utm, referrerHost, userAgent) {
  if (utm.source) {
    return {
      source: labelFromToken(utm.source),
      detail: utm.medium ? `${utm.source} / ${utm.medium}` : utm.source
    };
  }
  const fromReferrer = sourceFromHost(referrerHost);
  if (fromReferrer) {
    return { source: fromReferrer, detail: referrerHost };
  }
  if (/instagram/i.test(userAgent)) {
    return { source: "Instagram", detail: "instagram in-app browser" };
  }
  return { source: "Direct / unknown", detail: "" };
}
function parseDevice(userAgent) {
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}
function parseBrowser(userAgent) {
  if (/instagram/i.test(userAgent)) return "Instagram app";
  if (/fban|fbav/i.test(userAgent)) return "Facebook app";
  if (/edg\//i.test(userAgent)) return "Edge";
  if (/opr\//i.test(userAgent)) return "Opera";
  if (/chrome|crios/i.test(userAgent)) return "Chrome";
  if (/firefox|fxios/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent)) return "Safari";
  return "Unknown";
}
function parseOs(userAgent) {
  if (/iphone|ipad|ios/i.test(userAgent)) return "iOS";
  if (/android/i.test(userAgent)) return "Android";
  if (/mac os|macintosh/i.test(userAgent)) return "macOS";
  if (/windows/i.test(userAgent)) return "Windows";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Unknown";
}
function shouldIgnoreVisit(request) {
  const dnt = request.headers.get("dnt");
  const userAgent = request.headers.get("user-agent") || "";
  return dnt === "1" || /bot|crawler|spider|preview|slurp|facebookexternalhit|discordbot/i.test(
    userAgent
  );
}
function isAllowedAnalyticsRequest(request, url) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  if (!origin) return true;
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
}
function createVisitEvent(payload, request, siteUrl) {
  const userAgent = request.headers.get("user-agent") || "";
  const utm = cleanUtm(payload.utm);
  const referrer = cleanReferrer(payload.referrer, siteUrl.origin);
  const source = detectSource(utm, referrer.host, userAgent);
  return {
    id: randomUUID(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    path: cleanPath(payload.path),
    title: cleanString(payload.title, 120),
    source: source.source,
    sourceDetail: source.detail,
    referrerHost: referrer.host,
    referrerPath: referrer.path,
    utm,
    language: cleanString(payload.language, 30),
    timezone: cleanString(payload.timezone, 80),
    viewport: cleanString(payload.viewport, 30),
    country: cleanString(request.headers.get("x-vercel-ip-country"), 8),
    device: parseDevice(userAgent),
    browser: parseBrowser(userAgent),
    os: parseOs(userAgent)
  };
}
async function kvCommand(command, readOnly = false) {
  const restUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)?.replace(/\/+$/, "");
  const token = readOnly ? process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN : process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!restUrl || !token) {
    throw new Error("KV storage is not configured");
  }
  const response = await fetch(restUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(command)
  });
  if (!response.ok) {
    throw new Error(`KV command failed with ${response.status}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data.result;
}
function hasKvWriteStorage() {
  return Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}
function hasKvReadStorage() {
  return Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}
async function saveLocalVisit(visit) {
  await mkdir(dirname(LOCAL_FILE), { recursive: true });
  await appendFile(LOCAL_FILE, `${JSON.stringify(visit)}
`, "utf8");
}
async function readLocalVisits(limit) {
  try {
    const contents = await readFile(LOCAL_FILE, "utf8");
    return contents.split("\n").filter(Boolean).reverse().slice(0, limit).flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
async function saveVisit(visit) {
  if (hasKvWriteStorage()) {
    await kvCommand(["LPUSH", ANALYTICS_KEY, JSON.stringify(visit)]);
    await kvCommand([
      "LTRIM",
      ANALYTICS_KEY,
      "0",
      String(Math.max(MAX_EVENTS - 1, 0))
    ]);
    return;
  }
  await saveLocalVisit(visit);
}
async function getVisitEvents(limit = 500) {
  if (hasKvReadStorage()) {
    const rows = await kvCommand(
      ["LRANGE", ANALYTICS_KEY, "0", String(Math.max(limit - 1, 0))],
      true
    );
    return rows.flatMap((row) => {
      try {
        return [JSON.parse(row)];
      } catch {
        return [];
      }
    });
  }
  return readLocalVisits(limit);
}
function getAnalyticsStorageLabel() {
  if (hasKvWriteStorage()) return "Vercel KV";
  if (process.env.VERCEL === "1") return "temporary serverless storage";
  return "local development storage";
}
function safeEqual(value, expected) {
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}
function isAnalyticsAuthorized(url, request) {
  const configuredSecret = process.env.ANALYTICS_SECRET;
  const suppliedSecret = url.searchParams.get("key") || request.headers.get("x-analytics-secret") || "";
  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production" && suppliedSecret === "dev";
  }
  return safeEqual(suppliedSecret, configuredSecret);
}

export { saveVisit as a, isAnalyticsAuthorized as b, createVisitEvent as c, getAnalyticsStorageLabel as d, getVisitEvents as g, isAllowedAnalyticsRequest as i, shouldIgnoreVisit as s };
