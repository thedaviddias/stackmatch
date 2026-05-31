"use client";

import {
  type CityOption,
  type CountryOption,
  getCitiesForCountry,
  getCountryList,
} from "@stackmatch/utils/location";
import { Check, MapPin, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session-provider";
import { api } from "@/data/api";
import { useMutation, useQuery } from "@/data/react";

const CITY_DROPDOWN_BLUR_DELAY_MS = 200;

export function LocationSettings() {
  const { session } = useSession();
  const myGitHubLogin = useQuery(api.auth.getMyGitHubLogin, session?.user ? {} : "skip");
  const profile = useQuery(
    api.queries.users.getProfile,
    myGitHubLogin ? { owner: myGitHubLogin } : "skip"
  );
  const updateLocation = useMutation(api.mutations.profiles.updateLocation);

  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [citySearch, setCitySearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  // Sync state from profile on load
  useEffect(() => {
    if (profile) {
      setSelectedCountry(profile.locationCountryCode ?? "");
      setSelectedCity(profile.locationCity ?? "");
    }
  }, [profile]);

  const countries = useMemo(() => getCountryList(), []);

  const citiesForCountry = useMemo(() => {
    if (!selectedCountry) return [];
    return getCitiesForCountry(selectedCountry);
  }, [selectedCountry]);

  const filteredCities = useMemo(() => {
    if (!citySearch) return citiesForCountry;
    const q = citySearch.toLowerCase();
    return citiesForCountry.filter((c) => c.name.toLowerCase().includes(q));
  }, [citiesForCountry, citySearch]);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    const currentCountry = profile.locationCountryCode ?? "";
    const currentCity = profile.locationCity ?? "";
    return selectedCountry !== currentCountry || selectedCity !== currentCity;
  }, [profile, selectedCountry, selectedCity]);

  const handleCountryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedCountry(code);
    setSelectedCity("");
    setCitySearch("");
  }, []);

  const handleCitySelect = useCallback((city: CityOption) => {
    setSelectedCity(city.canonical);
    setCitySearch(city.name);
    setShowCityDropdown(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      await updateLocation({
        locationCountryCode: selectedCountry || undefined,
        locationCity: selectedCity || undefined,
      });
      toast.success("Location updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update location");
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, selectedCountry, selectedCity, updateLocation]);

  const handleClear = useCallback(async () => {
    setSelectedCountry("");
    setSelectedCity("");
    setCitySearch("");
    setIsSaving(true);
    try {
      await updateLocation({
        locationCountryCode: undefined,
        locationCity: undefined,
      });
      toast.success("Location cleared");
    } catch {
      toast.error("Failed to clear location");
    } finally {
      setIsSaving(false);
    }
  }, [updateLocation]);

  if (!profile) {
    return (
      <div className="animate-pulse rounded-2xl border border-border bg-muted p-6 dark:border-neutral-800 dark:bg-white/[0.02]">
        <div className="h-5 w-40 rounded bg-muted-foreground/20 dark:bg-neutral-800" />
        <div className="mt-4 h-10 rounded-lg bg-muted-foreground/20 dark:bg-neutral-800" />
        <div className="mt-3 h-10 rounded-lg bg-muted-foreground/20 dark:bg-neutral-800" />
      </div>
    );
  }

  const displayCity = selectedCity
    ? selectedCity
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : "";

  return (
    <div className="rounded-2xl border border-neutral-800 bg-white/[0.02] p-6">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <MapPin className="h-4 w-4 text-th-accent-1-text" />
        Location
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Set your location for better proximity-based matching. This overrides the auto-detected
        location from your GitHub profile.
      </p>

      {profile.location && !selectedCountry && (
        <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-xs text-neutral-400">
          <span className="font-semibold text-neutral-300">GitHub location:</span>{" "}
          {profile.location}
        </div>
      )}

      {/* Country dropdown */}
      <div className="mt-4">
        <label htmlFor="location-country" className="block text-xs font-semibold text-neutral-400">
          Country
        </label>
        <select
          id="location-country"
          value={selectedCountry}
          onChange={handleCountryChange}
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-th-accent-1 focus:ring-1 focus:ring-th-accent-1/30"
        >
          <option value="">Select a country...</option>
          {countries.map((c: CountryOption) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* City typeahead */}
      {selectedCountry && (
        <div className="relative mt-3">
          <label htmlFor="location-city" className="block text-xs font-semibold text-neutral-400">
            City <span className="font-normal text-neutral-600">(optional)</span>
          </label>
          <input
            id="location-city"
            type="text"
            value={showCityDropdown ? citySearch : displayCity}
            onChange={(e) => {
              setCitySearch(e.target.value);
              setShowCityDropdown(true);
              if (!e.target.value) {
                setSelectedCity("");
              }
            }}
            onFocus={() => {
              setShowCityDropdown(true);
              setCitySearch("");
            }}
            onBlur={() => {
              // Delay to allow click on dropdown items
              setTimeout(() => setShowCityDropdown(false), CITY_DROPDOWN_BLUR_DELAY_MS);
            }}
            placeholder={
              citiesForCountry.length > 0 ? "Search or type your city..." : "Type your city name..."
            }
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-th-accent-1 focus:ring-1 focus:ring-th-accent-1/30"
          />

          {/* City dropdown */}
          {showCityDropdown && filteredCities.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl">
              {filteredCities.map((city: CityOption) => (
                <button
                  key={city.canonical}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleCitySelect(city);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-800 ${
                    selectedCity === city.canonical ? "text-th-accent-1-text" : "text-neutral-300"
                  }`}
                >
                  {city.name}
                  {selectedCity === city.canonical && <Check className="ml-auto h-3 w-3" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-th-accent-1 px-4 py-2 text-xs font-bold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? "Saving..." : "Save Location"}
        </button>

        {(selectedCountry || selectedCity) && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isSaving}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900/50 px-3 py-2 text-xs font-semibold text-neutral-400 transition-all hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-40"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {selectedCountry && (
        <p className="mt-3 text-[11px] text-neutral-600">
          Your location is used for proximity matching. Developers in your area will rank slightly
          higher in your match results.
        </p>
      )}
    </div>
  );
}
