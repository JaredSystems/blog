import type { LocationEstimate, TrafficEvent } from "./traffic";

// Curated ZIP context, not neighborhood boundaries or a second geolocation
// result. Add entries only with sources; never replace the provider's city/ZIP.
// 33196: Hammocks Community Park and West Kendall Regional Library.
// https://www.miamidade.gov/parks/hammocks.asp
// https://www.miamidade.gov/initiative/weather-ready/extreme-heat/cooling-sites.page
const MIAMI_DADE_ZIP_AREAS: Readonly<Record<string, string>> = {
  "33196": "The Hammocks / West Kendall",
};

export function approximateArea(location: LocationEstimate): string | null {
  if (location.country.trim().toUpperCase() !== "US" || location.region.trim().toUpperCase() !== "FL") return null;
  const zip = /^(\d{5})(?:-\d{4})?$/.exec(location.postal.trim())?.[1];
  return zip ? MIAMI_DADE_ZIP_AREAS[zip] ?? null : null;
}

export function visibleLocations(
  event: Pick<TrafficEvent, "location" | "vercelLocation">,
  includeGeoLite = false,
): LocationEstimate[] {
  if (includeGeoLite) return event.vercelLocation ? [event.vercelLocation, event.location] : [event.location];
  // Older events stored GeoLite in `location` and Vercel in `vercelLocation`.
  // Read the Vercel copy without rewriting history or revealing disabled data.
  const vercel = [event.vercelLocation, event.location].find(estimate => estimate?.provider === "Vercel");
  return [vercel ?? { city: "", region: "", country: "", postal: "", provider: "Vercel", accuracyKm: null }];
}
