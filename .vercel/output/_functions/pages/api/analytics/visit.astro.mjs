import { i as isAllowedAnalyticsRequest, s as shouldIgnoreVisit, c as createVisitEvent, a as saveVisit } from '../../../chunks/analytics_B5SNUy91.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  }
});
const POST = async ({ request, url }) => {
  if (!isAllowedAnalyticsRequest(request, url)) {
    return json({ ok: false }, 403);
  }
  if (shouldIgnoreVisit(request)) {
    return json({ ok: true, skipped: true });
  }
  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }
  const visit = createVisitEvent(payload, request, url);
  await saveVisit(visit);
  return json({ ok: true });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
