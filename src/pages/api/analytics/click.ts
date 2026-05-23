import type { APIRoute } from "astro";
import {
  createClickEvent,
  isAllowedAnalyticsRequest,
  saveClick,
  shouldIgnoreVisit,
} from "../../../lib/analytics";

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });

export const POST: APIRoute = async ({ request, url }) => {
  if (!isAllowedAnalyticsRequest(request, url)) {
    return json({ ok: false }, 403);
  }

  if (shouldIgnoreVisit(request)) {
    return json({ ok: true, skipped: true });
  }

  let payload: Record<string, unknown> = {};

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  const click = createClickEvent(payload, request);

  if (!click) {
    return json({ ok: true, skipped: true });
  }

  await saveClick(click);

  return json({ ok: true });
};
