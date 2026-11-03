import { isIP } from "node:net";
import { clean, geoLiteEnabled, privateHash, TRAFFIC_PREFIX, type LocationEstimate } from "./traffic";
import { incrementWindow, redis } from "./traffic-store";

export function vercelLocation(headers: Headers): LocationEstimate {
  const field = (name: string) => {
    const value = headers.get(`x-vercel-ip-${name}`) || "";
    try { return clean(decodeURIComponent(value)); } catch { return clean(value); }
  };
  return { country: field("country"), region: field("country-region"), city: field("city"),
    postal: field("postal-code"), provider: "Vercel", accuracyKm: null };
}

export function requestIP(request: Request): string {
  // Vercel overwrites x-forwarded-for with the public requester IP.
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  return isIP(ip) ? ip : "";
}

export async function locate(request: Request) {
  const fallback = vercelLocation(request.headers);
  // Disabled by default, even if credentials remain configured. Do not read
  // the GeoLite cache, spend quota, or transmit visitor IPs while inactive.
  if (!geoLiteEnabled()) return { location: fallback, geoStatus: "vercel" as const };
  const account = process.env.MAXMIND_ACCOUNT_ID;
  const license = process.env.MAXMIND_LICENSE_KEY;
  const ip = requestIP(request);
  if (!account || !license || !ip) return { location: fallback, geoStatus: "vercel" as const };
  const cacheKey = `${TRAFFIC_PREFIX}:geo:${privateHash(`geo:${ip}`)}`;
  try {
    const cached = await redis<string | null>(["GET", cacheKey]);
    let estimate: LocationEstimate | null = cached ? JSON.parse(cached) : null;
    if (!cached) {
      // This integration calls only the free GeoLite service, never paid GeoIP.
      // Keep headroom under the account quota and use Vercel when exhausted.
      const uses = await incrementWindow(`geo-quota:${new Date().toISOString().slice(0, 10)}`, 172800);
      if (uses > 900) throw new Error("GeoLite daily budget exhausted");
      const response = await fetch(`https://geolite.info/geoip/v2.1/city/${encodeURIComponent(ip)}`, {
        headers: { authorization: `Basic ${Buffer.from(`${account}:${license}`).toString("base64")}` },
        signal: AbortSignal.timeout(1800),
      });
      if (!response.ok) throw new Error("GeoLite lookup unavailable");
      const data = await response.json();
      estimate = {
        country: clean(data.country?.iso_code, 8), region: clean(data.subdivisions?.[0]?.iso_code, 40),
        city: clean(data.city?.names?.en), postal: clean(data.postal?.code, 20), provider: "MaxMind GeoLite",
        accuracyKm: Number.isFinite(data.location?.accuracy_radius) ? data.location.accuracy_radius : null,
      };
      await redis(["SET", cacheKey, JSON.stringify(estimate), "EX", 86400]);
    }
    if (!estimate?.city) return { location: fallback, geoStatus: "fallback" as const };
    // Keep the two providers separate. Mixing a Vercel ZIP into a GeoLite city
    // would suggest an agreement/precision that neither provider actually gave.
    return { location: estimate, vercelLocation: fallback, geoStatus: "geolite" as const };
  } catch {
    console.warn("traffic_geo_fallback"); // Never log the IP, credentials, or provider response.
    return { location: fallback, geoStatus: "fallback" as const };
  }
}
