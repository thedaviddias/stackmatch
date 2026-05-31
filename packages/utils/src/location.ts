import type { LocationProximityLevel, ParsedLocation } from "@stackmatch/types/ranking";

import { CITY_MAP, CONTINENT_MAP, COUNTRY_MAP, NON_GEOGRAPHIC, US_STATES } from "./location-data";

const MIN_VALID_COUNTRY_NAME_LENGTH = 3;

// ─── Parser ────────────────────────────────────────────────────

/**
 * Strip emojis and non-essential Unicode from a location string.
 * Keeps Latin characters, accented characters, spaces, commas, periods, hyphens.
 */
function cleanLocationString(raw: string): string {
  return (
    raw
      // Remove emoji and symbol Unicode ranges
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
      .replace(/[\u{2600}-\u{27BF}]/gu, "")
      .replace(/[\u{FE00}-\u{FE0F}]/gu, "") // variation selectors
      .replace(/[\u{200D}]/gu, "") // zero-width joiners
      // Remove flag emoji (regional indicators)
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Parse a freeform GitHub location string into structured location data.
 *
 * Handles formats like:
 * - "San Francisco, CA"
 * - "London, United Kingdom"
 * - "Germany"
 * - "Berlin"
 * - "NYC"
 * - "🌍 Remote"
 * - "São Paulo, Brazil"
 *
 * @returns Parsed location with city and/or countryCode, or null if unparseable
 */
export function parseGitHubLocation(raw: string | null | undefined): ParsedLocation | null {
  if (!raw) return null;

  const cleaned = cleanLocationString(raw).toLowerCase();
  if (!cleaned || cleaned.length < 2) return null;

  // Check for non-geographic terms
  if (NON_GEOGRAPHIC.has(cleaned)) return null;

  // Split by comma and trim each segment
  const segments = cleaned
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 0) return null;

  if (segments.length === 1) {
    // biome-ignore lint/style/noNonNullAssertion: length check guarantees element exists
    return parseSingleSegment(segments[0]!);
  }

  if (segments.length === 2) {
    const [first, second] = segments as [string, string];
    return parseTwoSegments(first, second);
  }

  return parseThreeOrMoreSegments(segments);
}

function parseSingleSegment(seg: string): ParsedLocation | null {
  // Try country first (higher confidence)
  const country = lookupCountry(seg);
  if (country) return { city: null, countryCode: country };

  // Try city
  const cityMatch = CITY_MAP.get(seg);
  if (cityMatch) return { city: cityMatch.canonical, countryCode: cityMatch.countryCode };

  // Try US state
  const usState = US_STATES.get(seg);
  if (usState) return { city: null, countryCode: "US" };

  return null;
}

function parseTwoSegments(first: string, second: string): ParsedLocation {
  // Try first segment as city — if recognized, the city's country is authoritative.
  // This prevents "San Francisco, CA" from being parsed as Canada (CA country code)
  // when CA actually means California.
  const cityMatch = CITY_MAP.get(first);
  if (cityMatch) {
    return { city: cityMatch.canonical, countryCode: cityMatch.countryCode };
  }

  // No known city — try second segment as country
  let countryCode = lookupCountry(second);

  // Try second segment as US state (e.g., "Portland, OR")
  if (!countryCode) {
    const usState = US_STATES.get(second);
    if (usState) countryCode = "US";
  }

  // First segment is an unrecognized city
  if (countryCode) {
    return { city: first, countryCode };
  }

  // If still no country, try first as country (reversed order)
  const firstAsCountry = lookupCountry(first);
  if (firstAsCountry) {
    return { city: null, countryCode: firstAsCountry };
  }

  // Last resort: try second as a known city (unusual but possible)
  const secondCity = CITY_MAP.get(second);
  if (secondCity) {
    return { city: secondCity.canonical, countryCode: secondCity.countryCode };
  }

  return { city: null, countryCode: null };
}

function parseThreeOrMoreSegments(segments: string[]): ParsedLocation | null {
  // biome-ignore lint/style/noNonNullAssertion: segments.length >= 3 guaranteed by caller
  const lastSeg = segments[segments.length - 1]!;
  // biome-ignore lint/style/noNonNullAssertion: segments.length >= 3 guaranteed by caller
  const firstSeg = segments[0]!;

  let countryCode = lookupCountry(lastSeg);
  if (!countryCode) {
    const secondToLast = segments[segments.length - 2];
    if (secondToLast) countryCode = lookupCountry(secondToLast);
  }

  let city: string | null = null;
  const cityMatch = CITY_MAP.get(firstSeg);
  if (cityMatch) {
    city = cityMatch.canonical;
    if (!countryCode) countryCode = cityMatch.countryCode;
  } else if (countryCode) {
    city = firstSeg;
  }

  if (!city && !countryCode) return null;
  return { city, countryCode };
}

function lookupCountry(segment: string): string | null {
  return COUNTRY_MAP.get(segment) ?? null;
}

// ─── Proximity Scoring ─────────────────────────────────────────

/** Score values for each proximity level. */
const PROXIMITY_SCORES: Record<LocationProximityLevel, number> = {
  same_city: 1.0,
  same_country: 0.6,
  same_continent: 0.3,
  different: 0.0,
  unknown: 0.0,
};

/**
 * Determine the geographic proximity level between two parsed locations.
 */
export function getLocationProximityLevel(
  a: ParsedLocation | null,
  b: ParsedLocation | null
): LocationProximityLevel {
  if (!a || !b) return "unknown";
  if (!a.countryCode || !b.countryCode) return "unknown";

  // Same city check (both must have a city and same country)
  if (a.city && b.city && a.city === b.city && a.countryCode === b.countryCode) {
    return "same_city";
  }

  // Same country
  if (a.countryCode === b.countryCode) return "same_country";

  // Same continent
  const continentA = CONTINENT_MAP.get(a.countryCode);
  const continentB = CONTINENT_MAP.get(b.countryCode);
  if (continentA && continentB && continentA === continentB) return "same_continent";

  return "different";
}

/**
 * Compute a 0-1 location proximity score between two raw GitHub location strings.
 */
export function computeLocationProximity(
  rawA: string | null | undefined,
  rawB: string | null | undefined
): number {
  const parsedA = parseGitHubLocation(rawA);
  const parsedB = parseGitHubLocation(rawB);
  const level = getLocationProximityLevel(parsedA, parsedB);
  return PROXIMITY_SCORES[level];
}

/**
 * Compute location proximity using structured fields when available,
 * falling back to freeform parsing.
 */
export function computeLocationProximityWithStructured(
  viewerStructured: { city?: string; countryCode?: string } | null | undefined,
  viewerRaw: string | null | undefined,
  candidateStructured: { city?: string; countryCode?: string } | null | undefined,
  candidateRaw: string | null | undefined
): number {
  const parsedA = resolveStructuredLocation(viewerStructured, viewerRaw);
  const parsedB = resolveStructuredLocation(candidateStructured, candidateRaw);
  const level = getLocationProximityLevel(parsedA, parsedB);
  return PROXIMITY_SCORES[level];
}

function resolveStructuredLocation(
  structured: { city?: string; countryCode?: string } | null | undefined,
  raw: string | null | undefined
): ParsedLocation | null {
  if (structured?.countryCode) {
    return {
      city: structured.city ?? null,
      countryCode: structured.countryCode,
    };
  }
  return parseGitHubLocation(raw);
}

// ─── Searchable Location Data ─────────────────────────────────
// Exported for UI consumption (settings page country/city pickers).

export interface CountryOption {
  code: string;
  name: string;
}

export interface CityOption {
  name: string;
  canonical: string;
  countryCode: string;
}

/** Deduplicated, sorted list of countries for a dropdown picker. */
let _countryListCache: CountryOption[] | null = null;

export function getCountryList(): CountryOption[] {
  if (_countryListCache) return _countryListCache;

  const codeToName = new Map<string, string>();
  for (const [name, code] of COUNTRY_MAP) {
    if (name.length <= MIN_VALID_COUNTRY_NAME_LENGTH || name.includes(".")) continue;
    const existing = codeToName.get(code);
    if (!existing || (name.length < existing.length && /^[a-z\s]+$/.test(name))) {
      codeToName.set(code, name);
    }
  }

  _countryListCache = Array.from(codeToName.entries())
    .map(([code, name]) => ({
      code,
      name: name
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return _countryListCache;
}

/** Deduplicated, sorted list of cities for a given country code. */
export function getCitiesForCountry(countryCode: string): CityOption[] {
  const seen = new Set<string>();
  const results: CityOption[] = [];

  for (const [, data] of CITY_MAP) {
    if (data.countryCode !== countryCode) continue;
    if (seen.has(data.canonical)) continue;
    seen.add(data.canonical);

    results.push({
      name: data.canonical
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      canonical: data.canonical,
      countryCode: data.countryCode,
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/** Search cities across all countries by prefix. Returns up to `limit` matches. */
export function searchCities(query: string, limit = 10): CityOption[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const seen = new Set<string>();
  const results: CityOption[] = [];

  for (const [name, data] of CITY_MAP) {
    if (!name.startsWith(q) && !data.canonical.startsWith(q)) continue;
    const key = `${data.canonical}|${data.countryCode}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      name: data.canonical
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      canonical: data.canonical,
      countryCode: data.countryCode,
    });

    if (results.length >= limit) break;
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}
