# Visitor analytics options for jaredsystems.com

Research date: 2026-11-03. Scope: research only; no application changes, deployment, live analytics inspection, or production test visits.

## Recommendation

For this small Astro blog, restore a focused private dashboard using a first-party event endpoint and the existing Upstash/Vercel KV connection pattern. Show a chronological event history, group pageviews and the Marmot outbound click into short-lived sessions, and display **estimated city and postal code** when Vercel provides them. This most directly matches the requested workflow without adding another application and SQL database to maintain. This is an architectural recommendation based on the repository and the capabilities below, not an implemented change.

Use **Umami self-hosted** if a maintained, ready-made analytics interface is more valuable than matching the old dashboard and postal-code requirement. Use **Matomo On-Premise** if richer visitor histories and a broader analytics suite justify maintaining a PHP application, SQL database, and geolocation data.

## What the old tracker actually provided

Repository evidence: commit `038d47b`, before removal in `0bc7db0`:

- `src/lib/analytics.ts`: timestamp, page path/title, referral/UTM information, device/browser/OS, and Vercel country/region/city. Neither `VisitEvent` nor `ClickEvent` has a session ID or postal-code field. The storage adapter accepts the existing `KV_*` or `UPSTASH_REDIS_*` environment-variable names; this research did not inspect their values or verify the live database.
- The same file stores visits and clicks in separate Redis lists, each capped at 1,000 events by default. The read functions default to 500 events. This is an event-count window, not a defined retention period.
- `src/pages/private/traffic.astro`: the dashboard loaded up to 500 of each event type and displayed 60 recent visits and 40 clicks. Its own explanation explicitly excluded stored IP addresses and postal codes.
- `src/components/VisitBeacon.astro`: client tracking respected Do Not Track. The historical beacon path did not fall back when `sendBeacon()` returned `false`; click tracking listened for `click`, not `auxclick`. These are concrete delivery/coverage improvements to consider separately from geography.

These sources can be inspected with `git show 038d47b:<path>`. A recorded pageview was an event; it was not a verified unique person or a complete browsing session.

## Comparison

| Option | Individual activity view | City and ZIP/postal support | Additional infrastructure | Fit for this blog |
| --- | --- | --- | --- | --- |
| Focused custom dashboard | Design an exact chronological log of received events, with session grouping and pagination | Vercel documents city and postal headers; both describe IP-derived geography, not verified location | Existing Astro/Vercel deployment and durable Redis; dashboard/authentication and reliability remain our responsibility | Best match for the specific private event history and postal field |
| Umami self-hosted | Sessions list and individual visitor profiles with activity history | Country/region/city are standard; no stock postal field in the inspected schema or geo collector | Node application plus PostgreSQL; Docker Compose available | Best ready-made lightweight alternative if city is sufficient |
| Matomo On-Premise | Paginated Visits Log and Visitor Profile with visit/action history | City with GeoIP2 setup; provider layer can return postal data, but no standard postal field in the inspected visitor-details output | PHP/webserver plus MySQL/MariaDB, report processing and geo-database updates | Richest individual-visit tooling, with more operations than this blog needs |

Evidence and qualifications for these comparisons follow.

## Geography: what can actually be promised

Vercel currently documents `x-vercel-ip-country`, `x-vercel-ip-country-region`, `x-vercel-ip-city`, and `x-vercel-ip-postal-code`. The city describes the requester's public IP location; Vercel describes the postal value as being close to the user's location. Consequently, the old tracker's missing ZIP field was not proof that Vercel lacked one. Reading the postal header is the simplest first option; it does not establish that every request will have a correct or populated postal code. [Vercel request headers](https://vercel.com/docs/headers/request-headers)

IP location is an estimate. MaxMind explicitly says it cannot guarantee complete accuracy or locate a specific person, household, or street address. A VPN can identify the exit server's location, and mobile networks can cover large areas. It may omit city/postal data when it cannot determine them sufficiently. Display `Unknown` for missing fields and label populated values as estimated. [MaxMind geolocation accuracy](https://support.maxmind.com/knowledge-base/articles/maxmind-geolocation-accuracy)

Changing dashboards does not establish better geographic accuracy than Google Analytics. This research did not compare providers against known visitor locations; the recommendation concerns access to individual recorded events and control over the dashboard.

Adding MaxMind does not turn ZIP into a verified residential location. Its API describes postal codes as near the user, can return partial postal codes outside the United States, and exposes an accuracy radius for geographic coordinates. A paid database can be evaluated later if Vercel coverage proves inadequate, but it is unnecessary for the first version and still cannot meet a promise of actual physical location. [MaxMind API response fields](https://dev.maxmind.com/geoip/docs/web-services/responses/), [MaxMind geolocation data](https://support.maxmind.com/knowledge-base/articles/maxmind-ip-geolocation-data)

## Umami self-hosted

The current documentation covers Umami v3. The Sessions screen groups activity by a session identifier, lists recent visitors and their viewed pages, and opens individual visitor profiles with activity histories. By default, the identifier derives from website ID, IP, User-Agent and a rotating salt without cookies. A session can contain multiple visits; this is not an identity guarantee. [Umami introduction](https://docs.umami.is/docs), [Sessions](https://docs.umami.is/docs/sessions)

Shared IP/browser combinations can merge activity, as Umami's own Distinct IDs documentation explains. Providing an application-controlled distinct ID can link sessions, but this anonymous blog does not already have an authenticated visitor identity. We should not present profiles as known individual people. [Distinct IDs](https://docs.umami.is/docs/distinct-ids)

The inspected stock `Session` schema contains `country`, `region`, and `city`, with no postal field. The geo collector reads country/region/city from provider headers, including Vercel, or the GeoLite2 City database, and returns only those location values. Therefore, **standard city support is verified; built-in ZIP capture/reporting is not**. ZIP would need additional enrichment/custom properties or a code extension, reducing the appeal of an off-the-shelf install for that requirement. [Umami schema](https://github.com/umami-software/umami/blob/master/prisma/schema.prisma), [Geo collector](https://github.com/umami-software/umami/blob/master/src/lib/detect.ts)

Umami uses the MIT license. Its current installation guide requires Node.js 20.19 or newer and PostgreSQL 12.14 or newer; it recommends Node 22 LTS. Docker Compose includes the application and PostgreSQL. The existing Redis database cannot substitute for that PostgreSQL store. Hosting, database backups, upgrades, and login configuration still need ownership. [Umami repository/license](https://github.com/umami-software/umami), [Installation](https://docs.umami.is/docs/install)

## Matomo On-Premise

The Visits Log supports browsing individual sessions, previous pages of visits, and other dates. Visitor Profile adds visit/action history and summaries. The documented profile summary uses at most the last 100 visits, while the visit list allows loading more. This is mature tooling for the chronological drill-down requirement. [Visits Log](https://matomo.org/faq/reports/the-visits-log-report/), [Visitor Profile](https://matomo.org/faq/reports/the-visitor-profile/)

City/region reporting requires configuring a GeoIP2 location provider and database. Matomo supports local DB-IP/MaxMind databases and automatic updates through its archiving process. The documentation warns that unknown cities remain possible and geolocation is not completely accurate. [Geolocation setup](https://matomo.org/faq/how-to/setting-up-accurate-visitors-geolocation/)

There is an important postal-code distinction: Matomo's provider API defines `POSTAL_CODE_KEY`, but the inspected 5.x visitor-details implementation adds continent, country, region, city, location, latitude, and longitude—not postal code—to visits. The standard geographic reports document country/region/city. Do not buy or install Matomo assuming a ZIP column will appear in Visits Log; verify an extension/custom dimension path separately if postal reporting is essential. This is a source-based assessment of the stock feature, not a claim that no third-party extension can provide it. [Location provider interface](https://github.com/matomo-org/matomo/blob/5.x-dev/plugins/UserCountry/LocationProvider.php), [Visitor details](https://github.com/matomo-org/matomo/blob/5.x-dev/plugins/UserCountry/VisitorDetails.php)

Matomo is GPL v3 or later and runs as a PHP/MySQL application. It needs a webserver, PHP extensions, and MySQL/MariaDB; newer major versions raise minimum versions, so choose a stable release and follow its requirements. The current requirements page distinguishes Matomo 5 from 6.0.0. This is additional infrastructure relative to the existing Astro/Redis setup; report archiving, backups, application upgrades, and geolocation updates also need maintenance. [Matomo repository/license](https://github.com/matomo-org/matomo), [On-Premise requirements](https://matomo.org/faq/on-premise/matomo-requirements/)

## Proposed scope if implementation is approved later

The following is a proposed design, not a description of existing behavior:

1. One authenticated private Astro dashboard and one first-party event collector for pageviews and the existing outbound links. Keep timestamp, path, referral/UTM, device/browser/OS, and estimated country/region/city/postal fields.
2. A short-lived random session identifier to connect a visit and a Marmot click. No persistent person identity or replay is required. A session is a browser grouping, not proof of an individual.
3. Store events durably in Redis with stable event IDs, bounded retry/deduplication behavior, and visible write failures. Upstash documents persistence to memory and disk; application retention/deletion policy still determines how much history remains. Confirm the existing database is active before relying on it. [Upstash durable storage](https://upstash.com/docs/redis/features/durability)
4. Replace the hidden 1,000/500/60-event windows with explicit retention, date/source/path/event filters, and pagination. Retention and storage budget should be visible rather than silently truncating history.
5. Production environment and hostname checks in both client and collector to keep local/preview traffic separate; respect Do Not Track; validate events and keep dashboard access private. Exercise delivery failures, duplicate delivery, and navigation/outbound-click behavior in a separate test dataset.

The strongest achievable claim is an inspectable log of the events the collector received. Browser blocking, navigation, lost requests, intentional opt-outs, and bots mean it is not a guaranteed census of humans. A Marmot outbound-click event demonstrates a recorded click on the blog; it does not prove the destination loaded successfully or reveal future direct visits to Marmot.

## Remaining uncertainties

- The live Redis resource, retention, and credentials were not inspected.
- Vercel postal-header population/quality for this site's real traffic was not tested.
- Neither alternative was installed or exercised. Umami and Matomo feature claims come from their official documentation and source; moving branch links can change after this research date.
- No claim is made that these options will collect every visit or expose a visitor's actual physical city/ZIP.
