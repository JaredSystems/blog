import { createHmac, timingSafeEqual } from "node:crypto";

export const TRAFFIC_HOSTS = ["jaredsystems.com", "www.jaredsystems.com"];
export const ADMIN_COOKIE = "__Host-traffic-admin";
export const RETENTION_DAYS = 90;
export const MAX_EVENTS = 10_000;
export const RETENTION_SECONDS = RETENTION_DAYS * 86400;
export const TRAFFIC_PREFIX = "blog:traffic:v2";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LocationEstimate = {
  country: string; region: string; city: string; postal: string;
  provider: "Vercel" | "MaxMind GeoLite";
  accuracyKm: number | null;
};
export type TrafficEvent = {
  id: string; session: string; type: "pageview" | "outbound";
  timestamp: string; receivedAt: string; path: string; title: string;
  referrer: string; source: string; medium: string; campaign: string;
  target: string; browser: string; os: string; device: string;
  location: LocationEstimate; vercelLocation?: LocationEstimate;
  geoStatus: "vercel" | "geolite" | "fallback";
  legacy?: boolean;
};

export function geoLiteEnabled(): boolean {
  return process.env.MAXMIND_ENABLED === "true" && Boolean(process.env.MAXMIND_ACCOUNT_ID && process.env.MAXMIND_LICENSE_KEY);
}

export function clean(value: unknown, length = 160): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, length) : "";
}

export function productionRequest(request: Request, productionBuild: boolean): boolean {
  const url = new URL(request.url);
  return productionBuild && process.env.VERCEL_ENV === "production" &&
    process.env.TRAFFIC_ENABLED === "true" && url.protocol === "https:" &&
    url.port === "" && TRAFFIC_HOSTS.includes(url.hostname);
}

export function sameOrigin(request: Request): boolean {
  return request.headers.get("origin") === new URL(request.url).origin &&
    !["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") || "");
}

export function ignoredRequest(request: Request): boolean {
  return request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1" ||
    /bot|crawler|spider|preview|slurp|facebookexternalhit|discordbot/i.test(request.headers.get("user-agent") || "") ||
    /(?:^|;\s*)traffic_ignore=1(?:;|$)/.test(request.headers.get("cookie") || "") || authorized(request);
}

function safeEqual(actual: string, expected: string): boolean {
  const a = Buffer.from(actual); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function validSecret(value: string): boolean {
  const secret = process.env.ANALYTICS_SECRET || "";
  return secret.length >= 32 && safeEqual(value, secret);
}

export function privateHash(value: string): string {
  const secret = process.env.ANALYTICS_SECRET;
  if (!secret || secret.length < 32) throw new Error("Traffic access key is not configured");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function adminToken(now = Date.now()): string {
  const expires = Math.floor(now / 1000) + 86400;
  return `${expires}.${privateHash(`traffic-admin:${expires}`)}`;
}

export function authorized(request: Request, now = Date.now()): boolean {
  const header = request.headers.get("x-analytics-secret");
  if (header && validSecret(header)) return true;
  const token = (request.headers.get("cookie") || "").split(";").map(s => s.trim())
    .find(s => s.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1) || "";
  const [expires, signature] = token.split(".");
  if (!/^\d{10}$/.test(expires || "") || !/^[a-f0-9]{64}$/.test(signature || "") ||
    Number(expires) <= now / 1000 || Number(expires) > now / 1000 + 86401 ||
    (process.env.ANALYTICS_SECRET || "").length < 32) return false;
  return safeEqual(signature, privateHash(`traffic-admin:${expires}`));
}

export function safeUrl(value: unknown): string {
  try {
    const url = new URL(clean(value, 2000));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    // Query strings and fragments can contain access tokens or personal data.
    return `${url.origin}${url.pathname}`.slice(0, 400);
  } catch { return ""; }
}

export function parseEvent(value: unknown, request: Request, now = Date.now()): Omit<TrafficEvent, "location" | "geoStatus"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (!UUID.test(String(p.id)) || !UUID.test(String(p.session)) ||
    !["pageview", "outbound"].includes(String(p.type))) return null;
  const path = clean(p.path, 300);
  if (!path.startsWith("/") || path.startsWith("//") || /[?#\\]/.test(path) ||
    /^\/(private|api)(\/|$)/i.test(path)) return null;
  const occurred = Number(p.timestamp);
  if (!Number.isFinite(occurred) || occurred < now - 86400000 || occurred > now + 300000) return null;
  const target = p.type === "outbound" ? safeUrl(p.target) : "";
  if (p.type === "outbound" && (!target || TRAFFIC_HOSTS.includes(new URL(target).hostname))) return null;
  const referrer = safeUrl(p.referrer);
  const refHost = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : "";
  const external = refHost && !TRAFFIC_HOSTS.includes(refHost);
  const source = clean(p.source, 80) || (external ? refHost : "(direct)");
  const ua = request.headers.get("user-agent") || "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox|FxiOS/.test(ua) ? "Firefox" :
    /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Other";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" :
    /Windows/.test(ua) ? "Windows" : /Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Other";
  return {
    id: String(p.id), session: String(p.session), type: p.type as TrafficEvent["type"],
    timestamp: new Date(Math.min(occurred, now)).toISOString(), receivedAt: new Date(now).toISOString(),
    path, title: clean(p.title, 120), referrer, source,
    medium: clean(p.medium, 80) || (external ? (/^(.*\.)?(google\.[a-z.]+|bing\.com|duckduckgo\.com)$/.test(refHost) ? "organic" : "referral") : "(none)"),
    campaign: clean(p.campaign, 120), target, browser, os,
    device: /iPad|Tablet/.test(ua) ? "Tablet" : /Mobile|Android|iPhone/.test(ua) ? "Mobile" : "Desktop",
  };
}

export async function readSmallBody(request: Request, max = 8192): Promise<string> {
  if (Number(request.headers.get("content-length") || 0) > max) throw new Error("Body too large");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) { await reader.cancel(); throw new Error("Body too large"); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
