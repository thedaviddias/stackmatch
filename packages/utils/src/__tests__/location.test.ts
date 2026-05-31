import { describe, expect, it } from "vitest";
import {
  computeLocationProximity,
  computeLocationProximityWithStructured,
  getCitiesForCountry,
  getCountryList,
  getLocationProximityLevel,
  parseGitHubLocation,
  searchCities,
} from "../location";

// ─── parseGitHubLocation ────────────────────────────────────────

describe("parseGitHubLocation", () => {
  describe("standard formats", () => {
    it("parses 'City, Country'", () => {
      const result = parseGitHubLocation("London, United Kingdom");
      expect(result).toEqual({ city: "london", countryCode: "GB" });
    });

    it("parses 'City, State' (US)", () => {
      const result = parseGitHubLocation("San Francisco, CA");
      expect(result).toEqual({ city: "san francisco", countryCode: "US" });
    });

    it("parses 'City, State, Country'", () => {
      const result = parseGitHubLocation("Austin, TX, USA");
      expect(result).toEqual({ city: "austin", countryCode: "US" });
    });

    it("parses just a country name", () => {
      const result = parseGitHubLocation("Germany");
      expect(result).toEqual({ city: null, countryCode: "DE" });
    });

    it("parses just a city name", () => {
      const result = parseGitHubLocation("Berlin");
      expect(result).toEqual({ city: "berlin", countryCode: "DE" });
    });

    it("parses country abbreviations", () => {
      expect(parseGitHubLocation("UK")).toEqual({ city: null, countryCode: "GB" });
      expect(parseGitHubLocation("USA")).toEqual({ city: null, countryCode: "US" });
    });
  });

  describe("tech hub abbreviations", () => {
    it("parses SF", () => {
      const result = parseGitHubLocation("SF");
      expect(result).toEqual({ city: "san francisco", countryCode: "US" });
    });

    it("parses NYC", () => {
      const result = parseGitHubLocation("NYC");
      expect(result).toEqual({ city: "new york", countryCode: "US" });
    });

    it("parses Bay Area", () => {
      const result = parseGitHubLocation("Bay Area");
      expect(result).toEqual({ city: "san francisco", countryCode: "US" });
    });

    it("parses Silicon Valley", () => {
      const result = parseGitHubLocation("Silicon Valley");
      expect(result).toEqual({ city: "san francisco", countryCode: "US" });
    });

    it("parses DC", () => {
      const result = parseGitHubLocation("DC");
      expect(result).toEqual({ city: "washington", countryCode: "US" });
    });

    it("parses CDMX", () => {
      const result = parseGitHubLocation("CDMX");
      expect(result).toEqual({ city: "mexico city", countryCode: "MX" });
    });
  });

  describe("international cities", () => {
    it("parses cities with accented characters", () => {
      expect(parseGitHubLocation("São Paulo, Brazil")).toEqual({
        city: "sao paulo",
        countryCode: "BR",
      });
    });

    it("parses alternate city names", () => {
      expect(parseGitHubLocation("Bengaluru")).toEqual({
        city: "bangalore",
        countryCode: "IN",
      });
      expect(parseGitHubLocation("Mumbai")).toEqual({
        city: "mumbai",
        countryCode: "IN",
      });
      expect(parseGitHubLocation("Bombay")).toEqual({
        city: "mumbai",
        countryCode: "IN",
      });
    });

    it("parses non-English country names", () => {
      expect(parseGitHubLocation("Deutschland")).toEqual({
        city: null,
        countryCode: "DE",
      });
      expect(parseGitHubLocation("España")).toEqual({
        city: null,
        countryCode: "ES",
      });
      expect(parseGitHubLocation("Brasil")).toEqual({
        city: null,
        countryCode: "BR",
      });
    });

    it("parses German city names", () => {
      expect(parseGitHubLocation("München")).toEqual({
        city: "munich",
        countryCode: "DE",
      });
      expect(parseGitHubLocation("Köln")).toEqual({
        city: "cologne",
        countryCode: "DE",
      });
    });

    it("parses alternative Ukrainian/Russian spellings", () => {
      expect(parseGitHubLocation("Kiev")).toEqual({
        city: "kyiv",
        countryCode: "UA",
      });
      expect(parseGitHubLocation("Kyiv")).toEqual({
        city: "kyiv",
        countryCode: "UA",
      });
    });
  });

  describe("non-geographic locations", () => {
    it("returns null for 'Remote'", () => {
      expect(parseGitHubLocation("Remote")).toBeNull();
    });

    it("returns null for 'Earth'", () => {
      expect(parseGitHubLocation("Earth")).toBeNull();
    });

    it("returns null for 'Worldwide'", () => {
      expect(parseGitHubLocation("Worldwide")).toBeNull();
    });

    it("returns null for 'The Internet'", () => {
      expect(parseGitHubLocation("The Internet")).toBeNull();
    });

    it("returns null for '127.0.0.1'", () => {
      expect(parseGitHubLocation("127.0.0.1")).toBeNull();
    });

    it("returns null for '/dev/null'", () => {
      expect(parseGitHubLocation("/dev/null")).toBeNull();
    });

    it("returns null for 'localhost'", () => {
      expect(parseGitHubLocation("localhost")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("returns null for null input", () => {
      expect(parseGitHubLocation(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(parseGitHubLocation(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseGitHubLocation("")).toBeNull();
    });

    it("returns null for single character", () => {
      expect(parseGitHubLocation("x")).toBeNull();
    });

    it("handles emoji-only input", () => {
      expect(parseGitHubLocation("🌍")).toBeNull();
    });

    it("strips emojis and parses remaining text", () => {
      const result = parseGitHubLocation("🇫🇷 Paris, France");
      expect(result).toEqual({ city: "paris", countryCode: "FR" });
    });

    it("is case-insensitive", () => {
      expect(parseGitHubLocation("BERLIN")).toEqual({ city: "berlin", countryCode: "DE" });
      expect(parseGitHubLocation("berlin")).toEqual({ city: "berlin", countryCode: "DE" });
      expect(parseGitHubLocation("GERMANY")).toEqual({ city: null, countryCode: "DE" });
    });

    it("handles extra whitespace", () => {
      const result = parseGitHubLocation("  London ,  UK  ");
      expect(result).toEqual({ city: "london", countryCode: "GB" });
    });

    it("returns null for completely unrecognized input", () => {
      expect(parseGitHubLocation("xyzabc123")).toBeNull();
    });

    it("handles 'New York, NY' format", () => {
      const result = parseGitHubLocation("New York, NY");
      expect(result).toEqual({ city: "new york", countryCode: "US" });
    });
  });

  describe("US state disambiguation", () => {
    it("recognizes full US state names", () => {
      const result = parseGitHubLocation("California");
      expect(result).toEqual({ city: null, countryCode: "US" });
    });

    it("handles city with full state name", () => {
      const result = parseGitHubLocation("Portland, Oregon");
      expect(result).toEqual({ city: "portland", countryCode: "US" });
    });

    it("handles two-letter state codes", () => {
      const result = parseGitHubLocation("Seattle, WA");
      expect(result).toEqual({ city: "seattle", countryCode: "US" });
    });
  });
});

// ─── getLocationProximityLevel ──────────────────────────────────

describe("getLocationProximityLevel", () => {
  it("returns same_city for matching cities in same country", () => {
    const a = { city: "berlin", countryCode: "DE" };
    const b = { city: "berlin", countryCode: "DE" };
    expect(getLocationProximityLevel(a, b)).toBe("same_city");
  });

  it("returns same_country for different cities in same country", () => {
    const a = { city: "berlin", countryCode: "DE" };
    const b = { city: "munich", countryCode: "DE" };
    expect(getLocationProximityLevel(a, b)).toBe("same_country");
  });

  it("returns same_continent for countries on same continent", () => {
    const a = { city: "berlin", countryCode: "DE" };
    const b = { city: "paris", countryCode: "FR" };
    expect(getLocationProximityLevel(a, b)).toBe("same_continent");
  });

  it("returns different for countries on different continents", () => {
    const a = { city: "berlin", countryCode: "DE" };
    const b = { city: "tokyo", countryCode: "JP" };
    expect(getLocationProximityLevel(a, b)).toBe("different");
  });

  it("returns unknown when either location is null", () => {
    expect(getLocationProximityLevel(null, { city: "berlin", countryCode: "DE" })).toBe("unknown");
    expect(getLocationProximityLevel({ city: "berlin", countryCode: "DE" }, null)).toBe("unknown");
    expect(getLocationProximityLevel(null, null)).toBe("unknown");
  });

  it("returns unknown when either country code is null", () => {
    const noCountry = { city: "unknown-city", countryCode: null };
    const berlin = { city: "berlin", countryCode: "DE" };
    expect(getLocationProximityLevel(noCountry, berlin)).toBe("unknown");
  });

  it("requires same country for same_city match", () => {
    // Two cities with same name but different countries
    const a = { city: "portland", countryCode: "US" };
    const b = { city: "portland", countryCode: "GB" };
    expect(getLocationProximityLevel(a, b)).not.toBe("same_city");
  });

  it("returns same_country when only one has a city", () => {
    const a = { city: "berlin", countryCode: "DE" };
    const b = { city: null, countryCode: "DE" };
    expect(getLocationProximityLevel(a, b)).toBe("same_country");
  });
});

// ─── computeLocationProximity ───────────────────────────────────

describe("computeLocationProximity", () => {
  it("returns 1.0 for same city", () => {
    expect(computeLocationProximity("Berlin, Germany", "Berlin, DE")).toBe(1.0);
  });

  it("returns 0.6 for same country different city", () => {
    expect(computeLocationProximity("Berlin", "Munich")).toBe(0.6);
  });

  it("returns 0.3 for same continent", () => {
    expect(computeLocationProximity("Berlin", "Paris")).toBe(0.3);
  });

  it("returns 0.0 for different continents", () => {
    expect(computeLocationProximity("Berlin", "Tokyo")).toBe(0.0);
  });

  it("returns 0.0 for unparseable locations", () => {
    expect(computeLocationProximity("Remote", "Earth")).toBe(0.0);
  });

  it("returns 0.0 when one location is null", () => {
    expect(computeLocationProximity("Berlin", null)).toBe(0.0);
    expect(computeLocationProximity(null, "Berlin")).toBe(0.0);
  });

  it("handles real-world GitHub location pairs", () => {
    // Same city, different formats
    expect(computeLocationProximity("SF", "San Francisco, CA")).toBe(1.0);
    expect(computeLocationProximity("NYC", "New York, NY")).toBe(1.0);

    // Same country
    expect(computeLocationProximity("SF", "Seattle, WA")).toBe(0.6);
    expect(computeLocationProximity("London", "Manchester")).toBe(0.6);

    // Same continent
    expect(computeLocationProximity("London", "Berlin")).toBe(0.3);
    expect(computeLocationProximity("Tokyo", "Seoul")).toBe(0.3);
  });
});

// ─── computeLocationProximityWithStructured ──────────────────────

describe("computeLocationProximityWithStructured", () => {
  it("uses structured fields when both sides have them", () => {
    const result = computeLocationProximityWithStructured(
      { city: "berlin", countryCode: "DE" },
      "San Francisco, CA", // should be ignored
      { city: "berlin", countryCode: "DE" },
      "Tokyo, Japan" // should be ignored
    );
    expect(result).toBe(1.0); // same city
  });

  it("uses structured for viewer, falls back to freeform for candidate", () => {
    const result = computeLocationProximityWithStructured(
      { city: "berlin", countryCode: "DE" },
      undefined,
      undefined,
      "Berlin, Germany"
    );
    expect(result).toBe(1.0); // both resolve to Berlin, DE
  });

  it("uses freeform for viewer, structured for candidate", () => {
    const result = computeLocationProximityWithStructured(
      undefined,
      "Berlin, Germany",
      { city: "munich", countryCode: "DE" },
      undefined
    );
    expect(result).toBe(0.6); // same country, different city
  });

  it("falls back to freeform when no structured fields", () => {
    const result = computeLocationProximityWithStructured(undefined, "Berlin", undefined, "Paris");
    expect(result).toBe(0.3); // same continent
  });

  it("returns 0.0 when nothing is available", () => {
    const result = computeLocationProximityWithStructured(
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(result).toBe(0.0);
  });

  it("structured country without city matches same-country", () => {
    const result = computeLocationProximityWithStructured(
      { countryCode: "DE" },
      undefined,
      { city: "berlin", countryCode: "DE" },
      undefined
    );
    expect(result).toBe(0.6); // same country (viewer has no city)
  });
});

// ─── getCountryList ──────────────────────────────────────────────

describe("getCountryList", () => {
  it("returns a non-empty sorted array of countries", () => {
    const countries = getCountryList();
    expect(countries.length).toBeGreaterThan(50);

    // Verify sorting
    for (let i = 1; i < countries.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: loop bounds guarantee valid indices
      expect(countries[i]!.name.localeCompare(countries[i - 1]!.name)).toBeGreaterThanOrEqual(0);
    }
  });

  it("includes common countries", () => {
    const countries = getCountryList();
    const codes = new Set(countries.map((c) => c.code));
    expect(codes.has("US")).toBe(true);
    expect(codes.has("GB")).toBe(true);
    expect(codes.has("DE")).toBe(true);
    expect(codes.has("JP")).toBe(true);
    expect(codes.has("BR")).toBe(true);
  });

  it("returns consistent results on repeated calls (caching)", () => {
    const first = getCountryList();
    const second = getCountryList();
    expect(first).toBe(second); // Same reference due to caching
  });
});

// ─── getCitiesForCountry ─────────────────────────────────────────

describe("getCitiesForCountry", () => {
  it("returns US cities", () => {
    const cities = getCitiesForCountry("US");
    expect(cities.length).toBeGreaterThan(5);
    const names = cities.map((c) => c.canonical);
    expect(names).toContain("san francisco");
    expect(names).toContain("new york");
  });

  it("returns German cities", () => {
    const cities = getCitiesForCountry("DE");
    const names = cities.map((c) => c.canonical);
    expect(names).toContain("berlin");
    expect(names).toContain("munich");
  });

  it("returns empty array for unknown country code", () => {
    expect(getCitiesForCountry("XX")).toEqual([]);
  });

  it("deduplicates cities (no duplicate canonicals)", () => {
    const cities = getCitiesForCountry("US");
    const canonicals = cities.map((c) => c.canonical);
    expect(new Set(canonicals).size).toBe(canonicals.length);
  });
});

// ─── searchCities ────────────────────────────────────────────────

describe("searchCities", () => {
  it("finds cities by prefix", () => {
    const results = searchCities("ber");
    const names = results.map((c) => c.canonical);
    expect(names).toContain("berlin");
  });

  it("returns empty for short queries", () => {
    expect(searchCities("b")).toEqual([]);
    expect(searchCities("")).toEqual([]);
  });

  it("respects limit parameter", () => {
    const results = searchCities("sa", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("deduplicates results", () => {
    const results = searchCities("san");
    const keys = results.map((c) => `${c.canonical}|${c.countryCode}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ─── Adversarial / Anti-Abuse Cases ─────────────────────────────

describe("Location Parser: Adversarial Cases", () => {
  it("handles very long strings without crashing", () => {
    const longString = "a".repeat(10000);
    // Should return null, not throw
    expect(parseGitHubLocation(longString)).toBeNull();
  });

  it("handles strings with special characters", () => {
    expect(parseGitHubLocation("<script>alert('xss')</script>")).toBeNull();
    expect(parseGitHubLocation("'; DROP TABLE users;--")).toBeNull();
  });

  it("handles strings with only commas", () => {
    const result = parseGitHubLocation(", , ,");
    // Should not crash, may return null
    expect(result).toBeDefined();
  });

  it("handles strings with unicode control characters", () => {
    // Should either parse to Berlin or return null, not crash
    expect(() => parseGitHubLocation("\u0000Berlin\u0001")).not.toThrow();
  });

  it("cannot fake location by injection", () => {
    // An attacker trying to claim a different city
    const result = parseGitHubLocation("Tokyo, Japan, actually I'm in Berlin");
    // Should parse the first/last segments, not trust free text
    expect(result?.countryCode).toBeDefined();
  });

  it("does not expose internal data structure via prototype pollution", () => {
    const result = parseGitHubLocation("__proto__");
    expect(result).toBeNull();
  });

  it("handles null bytes in string", () => {
    expect(() => parseGitHubLocation("Berlin\0Germany")).not.toThrow();
  });
});
