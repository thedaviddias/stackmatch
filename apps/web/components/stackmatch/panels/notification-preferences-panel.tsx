"use client";

import {
  DIGEST_PRESETS,
  NOTIFICATION_DEFAULT_DIGEST_WINDOW_MINUTES,
  NOTIFICATION_DEFAULT_MAX_DIGEST_ITEMS,
  NOTIFICATION_DEFAULT_MAX_EMAILS_PER_DAY,
  NOTIFICATION_MAX_DIGEST_ITEMS,
  NOTIFICATION_MAX_DIGEST_WINDOW_MINUTES,
  NOTIFICATION_MAX_EMAILS_PER_DAY,
  NOTIFICATION_MIN_DIGEST_ITEMS,
  NOTIFICATION_MIN_DIGEST_WINDOW_MINUTES,
  NOTIFICATION_MIN_EMAILS_PER_DAY,
} from "@stackmatch/constants/notifications";
import { MINUTE_MS } from "@stackmatch/constants/time";
import { Mail, RotateCcw, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ButtonCustom } from "@/components/ui/button";
import { api } from "@/data/api";
import { useMutation, useQuery } from "@/data/react";
import { captureUserActionError } from "@/lib/observability/user-action-errors";

const PREFERENCE_SKELETON_KEYS = [
  "pref-skeleton-1",
  "pref-skeleton-2",
  "pref-skeleton-3",
  "pref-skeleton-4",
  "pref-skeleton-5",
  "pref-skeleton-6",
] as const;
const DAYS_PER_WEEK = 7;

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.round(value)));
}

function sanitizeNumberInput(
  nextValue: number,
  fallback: number,
  min: number,
  max: number
): number {
  if (Number.isNaN(nextValue)) {
    return fallback;
  }

  return clampNumber(nextValue, min, max);
}

function toMinutes(ms: number | undefined): number {
  if (!ms || Number.isNaN(ms)) {
    return NOTIFICATION_DEFAULT_DIGEST_WINDOW_MINUTES;
  }

  return clampNumber(
    ms / MINUTE_MS,
    NOTIFICATION_MIN_DIGEST_WINDOW_MINUTES,
    NOTIFICATION_MAX_DIGEST_WINDOW_MINUTES
  );
}

export function NotificationPreferencesPanel() {
  const preferences = useQuery(api.queries.notifications.getMyNotificationPreferences, {});
  const updatePreferences = useMutation(
    api.mutations.notifications.updateMyNotificationPreferences
  );

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [starsEmailEnabled, setStarsEmailEnabled] = useState(true);
  const [generalEmailEnabled, setGeneralEmailEnabled] = useState(true);
  const [digestWindowMinutes, setDigestWindowMinutes] = useState(
    NOTIFICATION_DEFAULT_DIGEST_WINDOW_MINUTES
  );
  const [maxDigestItems, setMaxDigestItems] = useState(NOTIFICATION_DEFAULT_MAX_DIGEST_ITEMS);
  const [maxEmailsPerDay, setMaxEmailsPerDay] = useState(NOTIFICATION_DEFAULT_MAX_EMAILS_PER_DAY);

  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  const baselinePreferences = useMemo(() => {
    if (!preferences) {
      return null;
    }

    const categoryPreferences = new Map(
      preferences.categoryPreferences.map((item) => [item.category, item])
    );
    const globalEnabled = preferences.emailEnabled ?? true;

    return {
      emailEnabled: globalEnabled,
      starsEmailEnabled: categoryPreferences.get("stars")?.emailEnabled ?? globalEnabled,
      generalEmailEnabled: categoryPreferences.get("general")?.emailEnabled ?? globalEnabled,
      digestWindowMinutes: toMinutes(preferences.defaultDigestWindowMs),
      maxDigestItems: clampNumber(
        preferences.defaultMaxDigestItems ?? NOTIFICATION_DEFAULT_MAX_DIGEST_ITEMS,
        NOTIFICATION_MIN_DIGEST_ITEMS,
        NOTIFICATION_MAX_DIGEST_ITEMS
      ),
      maxEmailsPerDay: clampNumber(
        preferences.maxEmailsPerDay ?? NOTIFICATION_DEFAULT_MAX_EMAILS_PER_DAY,
        NOTIFICATION_MIN_EMAILS_PER_DAY,
        NOTIFICATION_MAX_EMAILS_PER_DAY
      ),
    };
  }, [preferences]);

  useEffect(() => {
    if (!baselinePreferences) {
      return;
    }

    setEmailEnabled(baselinePreferences.emailEnabled);
    setStarsEmailEnabled(baselinePreferences.starsEmailEnabled);
    setGeneralEmailEnabled(baselinePreferences.generalEmailEnabled);
    setDigestWindowMinutes(baselinePreferences.digestWindowMinutes);
    setMaxDigestItems(baselinePreferences.maxDigestItems);
    setMaxEmailsPerDay(baselinePreferences.maxEmailsPerDay);
  }, [baselinePreferences]);

  const hasPreferenceChanges = useMemo(() => {
    if (!baselinePreferences) {
      return false;
    }

    return (
      baselinePreferences.emailEnabled !== emailEnabled ||
      baselinePreferences.starsEmailEnabled !== starsEmailEnabled ||
      baselinePreferences.generalEmailEnabled !== generalEmailEnabled ||
      baselinePreferences.digestWindowMinutes !== digestWindowMinutes ||
      baselinePreferences.maxDigestItems !== maxDigestItems ||
      baselinePreferences.maxEmailsPerDay !== maxEmailsPerDay
    );
  }, [
    baselinePreferences,
    digestWindowMinutes,
    emailEnabled,
    generalEmailEnabled,
    starsEmailEnabled,
    maxDigestItems,
    maxEmailsPerDay,
  ]);

  const handleApplyPreset = (preset: (typeof DIGEST_PRESETS)[number]) => {
    setDigestWindowMinutes(preset.digestWindowMinutes);
    setMaxDigestItems(preset.maxDigestItems);
    setMaxEmailsPerDay(preset.maxEmailsPerDay);

    toast.success(
      `${preset.label} preset applied: ${preset.digestWindowMinutes}m, ${preset.maxDigestItems} items, ${preset.maxEmailsPerDay}/day.`
    );
  };

  const handleReset = () => {
    if (!baselinePreferences) {
      return;
    }

    setEmailEnabled(baselinePreferences.emailEnabled);
    setStarsEmailEnabled(baselinePreferences.starsEmailEnabled);
    setGeneralEmailEnabled(baselinePreferences.generalEmailEnabled);
    setDigestWindowMinutes(baselinePreferences.digestWindowMinutes);
    setMaxDigestItems(baselinePreferences.maxDigestItems);
    setMaxEmailsPerDay(baselinePreferences.maxEmailsPerDay);
  };

  const handleSavePreferences = async () => {
    if (!preferences) {
      return;
    }

    const sanitizedDigestWindow = clampNumber(
      digestWindowMinutes,
      NOTIFICATION_MIN_DIGEST_WINDOW_MINUTES,
      NOTIFICATION_MAX_DIGEST_WINDOW_MINUTES
    );
    const sanitizedMaxDigestItems = clampNumber(
      maxDigestItems,
      NOTIFICATION_MIN_DIGEST_ITEMS,
      NOTIFICATION_MAX_DIGEST_ITEMS
    );
    const sanitizedMaxEmailsPerDay = clampNumber(
      maxEmailsPerDay,
      NOTIFICATION_MIN_EMAILS_PER_DAY,
      NOTIFICATION_MAX_EMAILS_PER_DAY
    );

    setIsSavingPreferences(true);
    try {
      await updatePreferences({
        emailEnabled,
        defaultDigestWindowMinutes: sanitizedDigestWindow,
        defaultMaxDigestItems: sanitizedMaxDigestItems,
        maxEmailsPerDay: sanitizedMaxEmailsPerDay,
        categoryPreferences: [
          { category: "stars", emailEnabled: starsEmailEnabled },
          { category: "general", emailEnabled: generalEmailEnabled },
        ],
      });
      toast.success("Notification settings saved.");
    } catch (error) {
      captureUserActionError("update_notification_preferences", error, {
        emailEnabled,
        starsEmailEnabled,
        generalEmailEnabled,
      });
      toast.error(error instanceof Error ? error.message : "Failed to save notification settings.");
    } finally {
      setIsSavingPreferences(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-2">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
          <Settings2 className="h-5 w-5 text-th-accent-1" />
          Notification Settings
        </h2>
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-5">
        <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
          Delivery Preferences
        </p>

        {preferences === undefined ? (
          <div className="space-y-2">
            {PREFERENCE_SKELETON_KEYS.map((key) => (
              <div
                key={key}
                className="h-10 animate-pulse rounded-xl border border-border bg-muted dark:border-white/5 dark:bg-neutral-950/40"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3 text-xs text-neutral-200">
              <span>Email notifications</span>
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(event) => setEmailEnabled(event.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-xs text-neutral-300">
              <span>Stars emails</span>
              <input
                type="checkbox"
                checked={starsEmailEnabled}
                onChange={(event) => setStarsEmailEnabled(event.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-xs text-neutral-300">
              <span>General emails</span>
              <input
                type="checkbox"
                checked={generalEmailEnabled}
                onChange={(event) => setGeneralEmailEnabled(event.target.checked)}
              />
            </label>

            <div className="rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-[10px] text-neutral-400">
              Group notifications into digest emails to reduce send volume. Daily cap applies per
              owner.
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {DIGEST_PRESETS.map((preset) => (
                <ButtonCustom
                  key={preset.key}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  variant="outline"
                  size="xs"
                  className="h-9 border-white/10 bg-white/5 text-center text-neutral-300 hover:bg-white/10 hover:text-white"
                >
                  {preset.label}
                </ButtonCustom>
              ))}
            </div>

            <label className="block text-xs text-neutral-300">
              <span>Digest window (minutes)</span>
              <input
                type="number"
                min={NOTIFICATION_MIN_DIGEST_WINDOW_MINUTES}
                max={NOTIFICATION_MAX_DIGEST_WINDOW_MINUTES}
                value={digestWindowMinutes}
                onChange={(event) =>
                  setDigestWindowMinutes(
                    sanitizeNumberInput(
                      event.currentTarget.valueAsNumber,
                      digestWindowMinutes,
                      NOTIFICATION_MIN_DIGEST_WINDOW_MINUTES,
                      NOTIFICATION_MAX_DIGEST_WINDOW_MINUTES
                    )
                  )
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm text-white"
              />
            </label>

            <label className="block text-xs text-neutral-300">
              <span>Max items per email</span>
              <input
                type="number"
                min={NOTIFICATION_MIN_DIGEST_ITEMS}
                max={NOTIFICATION_MAX_DIGEST_ITEMS}
                value={maxDigestItems}
                onChange={(event) =>
                  setMaxDigestItems(
                    sanitizeNumberInput(
                      event.currentTarget.valueAsNumber,
                      maxDigestItems,
                      NOTIFICATION_MIN_DIGEST_ITEMS,
                      NOTIFICATION_MAX_DIGEST_ITEMS
                    )
                  )
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm text-white"
              />
            </label>

            <label className="block text-xs text-neutral-300">
              <span>Max emails per day</span>
              <input
                type="number"
                min={NOTIFICATION_MIN_EMAILS_PER_DAY}
                max={NOTIFICATION_MAX_EMAILS_PER_DAY}
                value={maxEmailsPerDay}
                onChange={(event) =>
                  setMaxEmailsPerDay(
                    sanitizeNumberInput(
                      event.currentTarget.valueAsNumber,
                      maxEmailsPerDay,
                      NOTIFICATION_MIN_EMAILS_PER_DAY,
                      NOTIFICATION_MAX_EMAILS_PER_DAY
                    )
                  )
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm text-white"
              />
            </label>

            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
              Potential max volume: {maxEmailsPerDay * DAYS_PER_WEEK} emails/week
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ButtonCustom
                type="button"
                onClick={handleReset}
                disabled={!hasPreferenceChanges || isSavingPreferences}
                variant="outline"
                size="xs"
                className="h-9 border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white aria-disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </ButtonCustom>

              <ButtonCustom
                type="button"
                onClick={handleSavePreferences}
                disabled={isSavingPreferences || !hasPreferenceChanges}
                variant="neon"
                size="xs"
                className="h-9 aria-disabled:opacity-50"
              >
                <Mail className="h-3.5 w-3.5" />
                {isSavingPreferences
                  ? "Saving..."
                  : hasPreferenceChanges
                    ? "Save Settings"
                    : "Saved"}
              </ButtonCustom>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
