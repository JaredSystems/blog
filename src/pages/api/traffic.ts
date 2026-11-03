import type { APIRoute } from "astro";
import { ignoredRequest, parseEvent, privateHash, productionRequest, readSmallBody, sameOrigin } from "../../lib/traffic";
import { locate, requestIP } from "../../lib/traffic-geo";
import { incrementWindow, saveEvent } from "../../lib/traffic-store";

export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  const reply = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (!productionRequest(request, import.meta.env.PROD)) return reply(404);
  if (!sameOrigin(request)) return reply(403);
  if (ignoredRequest(request)) return reply(204);
  if (!(request.headers.get("content-type") || "").startsWith("application/json")) return reply(415);
  let event;
  try { event = parseEvent(JSON.parse(await readSmallBody(request)), request); } catch { return reply(400); }
  if (!event) return reply(400);
  try {
    const ip = requestIP(request);
    // Daily keyed hash is only used for a one-minute abuse counter, not stored on events.
    const rate = await incrementWindow(`rate:${privateHash(`${new Date().toISOString().slice(0, 10)}:${ip || event.session}`)}`, 60);
    if (rate > 120) return new Response(null, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
    await saveEvent({ ...event, ...await locate(request) });
    return reply(204);
  } catch {
    console.error("traffic_storage_failure");
    return reply(503); // The browser can retry the same event ID safely.
  }
};
