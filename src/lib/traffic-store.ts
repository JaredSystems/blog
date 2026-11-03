import { MAX_EVENTS, RETENTION_SECONDS, TRAFFIC_PREFIX, type TrafficEvent } from "./traffic";

export async function redis<T>(command: unknown[]): Promise<T> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || token === "[SENSITIVE]") throw new Error("Traffic storage is not configured");
  const response = await fetch(url.replace(/\/+$/, ""), {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(command), signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) throw new Error("Traffic storage request failed");
  const result = await response.json();
  if (result.error) throw new Error("Traffic storage command failed");
  return result.result as T;
}

export const SAVE_EVENT_SCRIPT = `
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('SET', KEYS[4], ARGV[2], 'EX', ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[4])
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[7])
local overflow = redis.call('ZCARD', KEYS[1]) - tonumber(ARGV[5])
if overflow > 0 then
  local removed = redis.call('ZRANGE', KEYS[1], 0, overflow - 1)
  for _, id in ipairs(removed) do redis.call('DEL', ARGV[8] .. id) end
  redis.call('ZREMRANGEBYRANK', KEYS[1], 0, overflow - 1)
  redis.call('HINCRBY', KEYS[3], 'capacityRemoved', overflow)
end
redis.call('EXPIRE', KEYS[1], ARGV[3])
redis.call('HSET', KEYS[3], 'lastWrite', ARGV[6])
redis.call('EXPIRE', KEYS[3], ARGV[3])
redis.call('SET', KEYS[2], '1', 'EX', 90000)
return 1`;

export async function saveEvent(event: TrafficEvent, now = Date.now()): Promise<boolean> {
  return Boolean(await redis<number>(["EVAL", SAVE_EVENT_SCRIPT, 4,
    `${TRAFFIC_PREFIX}:events`, `${TRAFFIC_PREFIX}:seen:${event.id}`, `${TRAFFIC_PREFIX}:health`,
    `${TRAFFIC_PREFIX}:event:${event.id}`,
    Date.parse(event.timestamp), JSON.stringify(event), Math.max(1, Math.ceil(RETENTION_SECONDS - (now - Date.parse(event.timestamp)) / 1000)),
    now - RETENTION_SECONDS * 1000, MAX_EVENTS, new Date(now).toISOString(), event.id, `${TRAFFIC_PREFIX}:event:`]));
}

export async function incrementWindow(key: string, seconds: number): Promise<number> {
  return redis<number>(["EVAL", "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n", 1,
    `${TRAFFIC_PREFIX}:${key}`, seconds]);
}

export async function readEvents(from: number, to: number): Promise<TrafficEvent[]> {
  const ids = await redis<string[]>(["ZREVRANGEBYSCORE", `${TRAFFIC_PREFIX}:events`, to,
    Math.max(from, Date.now() - RETENTION_SECONDS * 1000), "LIMIT", 0, MAX_EVENTS]);
  if (!ids.length) return [];
  const rows = await redis<(string | null)[]>(["MGET", ...ids.map(id => `${TRAFFIC_PREFIX}:event:${id}`)]);
  return rows.flatMap(row => { try { return row ? [JSON.parse(row) as TrafficEvent] : []; } catch { return []; } });
}

export async function readHealth(): Promise<{ count: number; lastWrite?: string; capacityRemoved?: string }> {
  const [count, health] = await Promise.all([
    redis<number>(["ZCOUNT", `${TRAFFIC_PREFIX}:events`, Date.now() - RETENTION_SECONDS * 1000, "+inf"]),
    redis<string[] | Record<string, string>>(["HGETALL", `${TRAFFIC_PREFIX}:health`]),
  ]);
  const fields = Array.isArray(health)
    ? Object.fromEntries(Array.from({ length: health.length / 2 }, (_, i) => [health[i * 2], health[i * 2 + 1]]))
    : health;
  return { count, ...fields };
}

export async function readLegacy(): Promise<TrafficEvent[]> {
  const rows = await Promise.all([
    redis<string[]>(["LRANGE", process.env.ANALYTICS_KV_KEY || "blog:analytics:visits", 0, 9999]),
    redis<string[]>(["LRANGE", process.env.ANALYTICS_CLICKS_KV_KEY || "blog:analytics:clicks", 0, 9999]),
  ]);
  return rows.flatMap((list, type) => list.flatMap(row => {
    try {
      const old = JSON.parse(row);
      if (!Number.isFinite(Date.parse(old.timestamp))) return [];
      return [{
        id: old.id, session: "", type: type ? "outbound" : "pageview", timestamp: old.timestamp,
        receivedAt: old.timestamp, path: old.path || "/", title: old.title || "",
        referrer: old.referrerHost ? `https://${old.referrerHost}${old.referrerPath || "/"}` : "",
        source: old.source || "Unknown", medium: old.utm?.medium || "", campaign: old.utm?.campaign || "",
        target: old.targetUrl || "", browser: old.browser || "Unknown", os: old.os || "Unknown", device: old.device || "Unknown",
        location: { country: old.country || "", region: old.region || "", city: old.city || "", postal: "", provider: "Vercel", accuracyKm: null },
        geoStatus: "vercel", legacy: true,
      } as TrafficEvent];
    } catch { return []; }
  }));
}
