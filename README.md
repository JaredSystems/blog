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

Run `npm run typecheck` and `npm run test:analytics` to verify the integration.
The analytics check builds several environment configurations and exercises the
generated loader in an isolated JavaScript context; it sends no data to Google.
It also checks a running development server and verifies the former private
dashboard and collection endpoints return 404.

The former custom traffic dashboard, visit/click API, and Redis storage code
have been removed. Historical Redis records are no longer used by this site.
