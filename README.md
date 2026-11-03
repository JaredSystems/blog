My personal blog built with Astro.

Google Analytics uses the `jared-systems` GA4 property (470278319), web stream
`jaredsystems.com (production)`, measurement ID `G-CSPD10Q7MG`. Enhanced
measurement records outbound link clicks, including links to Marmot Systems.

Set `PUBLIC_GA_MEASUREMENT_ID` in the Vercel `blog` project's **Production**
environment only. Google Analytics is included only when Astro is building for
production and `VERCEL_ENV=production`. Before contacting Google, the browser
also requires HTTPS, the default port, and exactly `jaredsystems.com` or
`www.jaredsystems.com`. Local development, local production builds, Vercel
previews, and deployment-specific `*.vercel.app` URLs do not track visits.

## Private traffic dashboard

`/private/traffic` shows timestamped pageviews and outbound clicks, entry sources,
estimated city/region/country/ZIP, browser details, and a per-tab session timeline.
Date filters use UTC days; event timestamps display in America/New_York.
Search covers location, ZIP, source/campaign, page, and destination. Results are
paginated, 50 per page; summary counts reflect all matching retained events.

Set `TRAFFIC_ENABLED=true` **only in Vercel Production**. The browser component
requires an Astro production build and Vercel's production environment, and the
script checks HTTPS, the canonical hostname and default port before collecting.
The receiving endpoint independently enforces the same restrictions. The private
dashboard and collector return 404 in development and previews even when someone
copies production environment variables into them.

Storage uses existing `KV_REST_API_URL` + `KV_REST_API_TOKEN` (or their
`UPSTASH_REDIS_*` equivalents). `ANALYTICS_SECRET` must contain at least 32
characters. No new paid service or dependency is required. Hosting/Redis usage
still counts against the existing providers' plan quotas; this is not a promise
of unlimited free usage. There is no temporary-file fallback in production.

Open the existing secret bookmark to exchange its key for a Secure, HttpOnly,
SameSite=Strict login cookie and redirect to the clean dashboard URL. Alternatively,
enter the same key in the dashboard's sign-in form. Login lasts 24 hours. The
dashboard sends no analytics, is no-store/noindex, and has no third-party assets.
Signing in sets a separate `traffic_ignore=1` cookie excluding this browser from
custom tracking for one year, even after sign-out. Clear that site cookie to opt
back in. This does not change Google Analytics' separate collection.

New data uses `blog:traffic:v2:*`, separate from the previous tracker's Redis
lists. Events expire automatically after 90 days; a 10,000-event cap deletes the
oldest events sooner. The dashboard shows this cap and capacity-removal count.
Retry IDs expire after 25 hours; retries reuse an ID and atomic Redis operations
prevent duplicates. Clients queue at most 40 events in sessionStorage, discard
events older than 24 hours, and make up to five acknowledged delivery attempts.
Page-hide beacons cover navigation; unsuccessful enqueue falls back to fetch.
Regular and middle-button outbound clicks are recorded. Copying a link or using
a browser context menu is not guaranteed to produce a click event.

Sessions use a random UUID in sessionStorage, expire after 30 minutes of
inactivity, and retain the entry referrer/UTM values across pages. They describe
activity in a browser tab, not a known person or Google Analytics' first-user
source. The previous tracker archive is read-only and has no session/ZIP data;
its pre-existing count limits may already have removed older records. Archive
access reads up to 10,000 records from each old list and never migrates/deletes it.

Do Not Track, Global Privacy Control, known bot user agents, and admin/self
exclusion are honored. URL query strings/fragments, raw IP addresses, precise
coordinates, and full user-agent strings are not saved in event records. Source,
medium and campaign UTM labels are stored, so never put sensitive data in them.
The public collector validates origin, payload size/shape and timestamp, and
applies a per-IP minute rate limit using a short-lived keyed hash. This reduces
abuse; it cannot prove that every accepted event came from a real human.

### Optional free GeoLite city lookup

Create a free [MaxMind GeoLite account](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data/)
and configure `MAXMIND_ACCOUNT_ID` and `MAXMIND_LICENSE_KEY` as **Production-only**
server secrets. Redeploy to activate. The integration is hard-coded to the free
`geolite.info` City service, never the paid `geoip.maxmind.com` service.
Lookups share a 900-request UTC-day cap and a 24-hour cache keyed by an HMAC of
the IP. The raw IP is sent to MaxMind for this optional lookup but not stored in
the event or cache key. Respect the account's actual quota, which can change and
may also be consumed by other applications.

The dashboard preserves the GeoLite and Vercel estimates separately, including
GeoLite's accuracy radius when supplied. It never substitutes a neighborhood
from an estimated ZIP or combines a Vercel ZIP with a GeoLite city. Missing
credentials, missing city data, quota exhaustion, or lookup failure use Vercel.
This does not guarantee more precise or accurate city names; compare providers
using voluntarily confirmed test locations before drawing that conclusion.

### Verification and operations

Run `npm run typecheck`, `npm run test:analytics`, and `npm run test:traffic`.
The build checks cover local, preview, production and a running development
server. They send no data to Google. The traffic suite uses a temporary local
Redis Docker container and synthetic requests, including storage failure,
deduplication, retention, auth, geolocation fallback and browser navigation.
Docker is needed only for that integration test, not the application.

Collection returns 503 when storage fails so the browser can retry; Vercel logs
contain `traffic_storage_failure` without credentials or visitor IPs. The private
dashboard reports a storage outage instead of displaying zero visits. GeoLite
errors log `traffic_geo_fallback` and preserve the visit using Vercel estimates.
Set `TRAFFIC_ENABLED=false` in Production and redeploy to stop custom collection.
The former `/api/analytics/visit` and `/api/analytics/click` routes stay removed.
