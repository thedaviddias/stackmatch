"use client";

import {
  DIGEST_PRESETS,
  NOTIFICATION_CATEGORY_GENERAL,
  NOTIFICATION_CATEGORY_PROFILES,
  NOTIFICATION_CATEGORY_STARS,
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
import { useMemo, useReducer } from "react";
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

interface NotificationPreferencesValue {
  emailEnabled?: boolean;
  defaultDigestWindowMs?: number;
  defaultMaxDigestItems?: number;
  maxEmailsPerDay?: number;
  categoryPreferences: Array<{
    category: string;
    emailEnabled?: boolean;
  }>;
}

interface PreferencesDraft {
  emailEnabled: boolean;
  starsEmailEnabled: boolean;
  profilesEmailEnabled: boolean;
  generalEmailEnabled: boolean;
  digestWindowMinutes: number;
  maxDigestItems: number;
  maxEmailsPerDay: number;
}

type BooleanPreferenceKey =
  | "emailEnabled"
  | "starsEmailEnabled"
  | "profilesEmailEnabled"
  | "generalEmailEnabled";
type NumberPreferenceKey = "digestWindowMinutes" | "maxDigestItems" | "maxEmailsPerDay";

interface PreferencesDraftState {
  baselineKey: string | null;
  draft: PreferencesDraft | null;
  isSavingPreferences: boolean;
}

type PreferencesDraftAction =
  | {
      type: "setBoolean";
      key: BooleanPreferenceKey;
      value: boolean;
      baselineKey: string;
      currentDraft: PreferencesDraft;
    }
  | {
      type: "setNumber";
      key: NumberPreferenceKey;
      value: number;
      baselineKey: string;
      currentDraft: PreferencesDraft;
    }
  | {
      type: "applyPreset";
      preset: (typeof DIGEST_PRESETS)[number];
      baselineKey: string;
      currentDraft: PreferencesDraft;
    }
  | {
      type: "reset";
      baseline: PreferencesDraft;
      baselineKey: string;
    }
  | {
      type: "setSaving";
      isSavingPreferences: boolean;
    };

const DEFAULT_DRAFT: PreferencesDraft = {
  emailEnabled: true,
  starsEmailEnabled: true,
  profilesEmailEnabled: true,
  generalEmailEnabled: true,
  digestWindowMinutes: NOTIFICATION_DEFAULT_DIGEST_WINDOW_MINUTES,
  maxDigestItems: NOTIFICATION_DEFAULT_MAX_DIGEST_ITEMS,
  maxEmailsPerDay: NOTIFICATION_DEFAULT_MAX_EMAILS_PER_DAY,
};

const INITIAL_DRAFT_STATE: PreferencesDraftState = {
  baselineKey: null,
  draft: null,
  isSavingPreferences: false,
};

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

function getBaselinePreferences(
  preferences: NotificationPreferencesValue | null | undefined
): PreferencesDraft | null {
  if (!preferences) {
    return null;
  }

  const categoryPreferences = new Map(
    preferences.categoryPreferences.map((item) => [item.category, item])
  );
  const globalEnabled = preferences.emailEnabled ?? true;

  return {
    emailEnabled: globalEnabled,
    starsEmailEnabled:
      categoryPreferences.get(NOTIFICATION_CATEGORY_STARS)?.emailEnabled ?? globalEnabled,
    profilesEmailEnabled:
      categoryPreferences.get(NOTIFICATION_CATEGORY_PROFILES)?.emailEnabled ?? globalEnabled,
    generalEmailEnabled:
      categoryPreferences.get(NOTIFICATION_CATEGORY_GENERAL)?.emailEnabled ?? globalEnabled,
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
}

function getDraftKey(draft: PreferencesDraft): string {
  return [
    draft.emailEnabled,
    draft.starsEmailEnabled,
    draft.profilesEmailEnabled,
    draft.generalEmailEnabled,
    draft.digestWindowMinutes,
    draft.maxDigestItems,
    draft.maxEmailsPerDay,
  ].join("|");
}

function areDraftsEqual(first: PreferencesDraft, second: PreferencesDraft): boolean {
  return getDraftKey(first) === getDraftKey(second);
}

function preferencesDraftReducer(
  state: PreferencesDraftState,
  action: PreferencesDraftAction
): PreferencesDraftState {
  switch (action.type) {
    case "setBoolean":
    case "setNumber":
      return {
        ...state,
        baselineKey: action.baselineKey,
        draft: { ...action.currentDraft, [action.key]: action.value },
      };
    case "applyPreset":
      return {
        ...state,
        baselineKey: action.baselineKey,
        draft: {
          ...action.currentDraft,
          digestWindowMinutes: action.preset.digestWindowMinutes,
          maxDigestItems: action.preset.maxDigestItems,
          maxEmailsPerDay: action.preset.maxEmailsPerDay,
        },
      };
    case "reset":
      return {
        ...state,
        baselineKey: action.baselineKey,
        draft: action.baseline,
      };
    case "setSaving":
      return {
        ...state,
        isSavingPreferences: action.isSavingPreferences,
      };
  }
}

function resolveDraft(
  state: PreferencesDraftState,
  baseline: PreferencesDraft | null,
  baselineKey: string | null
): PreferencesDraft {
  if (!baseline || !baselineKey) {
    return DEFAULT_DRAFT;
  }

  if (state.baselineKey === baselineKey && state.draft) {
    return state.draft;
  }

  return baseline;
}

function PreferenceSkeleton() {
  return (
    <div className="space-y-2">
      {PREFERENCE_SKELETON_KEYS.map((key) => (
        <div
          key={key}
          className="h-10 animate-pulse rounded-xl border border-border bg-muted dark:border-white/5 dark:bg-neutral-950/40"
        />
      ))}
    </div>
  );
}

interface CategoryToggleRowsProps {
  draft: PreferencesDraft;
  onToggle: (key: BooleanPreferenceKey, value: boolean) => void;
}

function CategoryToggleRows({ draft, onToggle }: CategoryToggleRowsProps) {
  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between gap-3 text-xs text-neutral-200">
        <span>Email notifications</span>
        <input
          type="checkbox"
          checked={draft.emailEnabled}
          onChange={(event) => onToggle("emailEnabled", event.target.checked)}
        />
      </label>

      <label className="flex items-center justify-between gap-3 text-xs text-neutral-300">
        <span>Stars emails</span>
        <input
          type="checkbox"
          checked={draft.starsEmailEnabled}
          onChange={(event) => onToggle("starsEmailEnabled", event.target.checked)}
        />
      </label>

      <label className="flex items-center justify-between gap-3 text-xs text-neutral-300">
        <span>Profile emails</span>
        <input
          type="checkbox"
          checked={draft.profilesEmailEnabled}
          onChange={(event) => onToggle("profilesEmailEnabled", event.target.checked)}
        />
      </label>

      <label className="flex items-center justify-between gap-3 text-xs text-neutral-300">
        <span>General emails</span>
        <input
          type="checkbox"
          checked={draft.generalEmailEnabled}
          onChange={(event) => onToggle("generalEmailEnabled", event.target.checked)}
        />
      </label>
    </div>
  );
}

interface DigestPresetButtonsProps {
  onApplyPreset: (preset: (typeof DIGEST_PRESETS)[number]) => void;
}

function DigestPresetButtons({ onApplyPreset }: DigestPresetButtonsProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {DIGEST_PRESETS.map((preset) => (
        <ButtonCustom
          key={preset.key}
          type="button"
          onClick={() => onApplyPreset(preset)}
          variant="outline"
          size="xs"
          className="h-9 border-white/10 bg-white/5 text-center text-neutral-300 hover:bg-white/10 hover:text-white"
        >
          {preset.label}
        </ButtonCustom>
      ))}
    </div>
  );
}

interface DigestNumberFieldsProps {
  draft: PreferencesDraft;
  onNumberChange: (key: NumberPreferenceKey, value: number) => void;
}

function DigestNumberFields({ draft, onNumberChange }: DigestNumberFieldsProps) {
  return (
    <>
      <label className="block text-xs text-neutral-300">
        <span>Digest window (minutes)</span>
        <input
          type="number"
          min={NOTIFICATION_MIN_DIGEST_WINDOW_MINUTES}
          max={NOTIFICATION_MAX_DIGEST_WINDOW_MINUTES}
          value={draft.digestWindowMinutes}
          onChange={(event) =>
            onNumberChange(
              "digestWindowMinutes",
              sanitizeNumberInput(
                event.currentTarget.valueAsNumber,
                draft.digestWindowMinutes,
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
          value={draft.maxDigestItems}
          onChange={(event) =>
            onNumberChange(
              "maxDigestItems",
              sanitizeNumberInput(
                event.currentTarget.valueAsNumber,
                draft.maxDigestItems,
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
          value={draft.maxEmailsPerDay}
          onChange={(event) =>
            onNumberChange(
              "maxEmailsPerDay",
              sanitizeNumberInput(
                event.currentTarget.valueAsNumber,
                draft.maxEmailsPerDay,
                NOTIFICATION_MIN_EMAILS_PER_DAY,
                NOTIFICATION_MAX_EMAILS_PER_DAY
              )
            )
          }
          className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm text-white"
        />
      </label>
    </>
  );
}

interface PreferenceActionButtonsProps {
  hasPreferenceChanges: boolean;
  isSavingPreferences: boolean;
  onReset: () => void;
  onSave: () => void;
}

function PreferenceActionButtons({
  hasPreferenceChanges,
  isSavingPreferences,
  onReset,
  onSave,
}: PreferenceActionButtonsProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <ButtonCustom
        type="button"
        onClick={onReset}
        disabled={!hasPreferenceChanges || isSavingPreferences}
        variant="outline"
        size="xs"
        className="h-9 border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white aria-disabled:opacity-50"
      >
        <RotateCcw className="size-3.5" />
        Reset
      </ButtonCustom>

      <ButtonCustom
        type="button"
        onClick={onSave}
        disabled={isSavingPreferences || !hasPreferenceChanges}
        variant="neon"
        size="xs"
        className="h-9 aria-disabled:opacity-50"
      >
        <Mail className="size-3.5" />
        {isSavingPreferences ? "Saving..." : hasPreferenceChanges ? "Save Settings" : "Saved"}
      </ButtonCustom>
    </div>
  );
}

interface NotificationPreferencesFormProps {
  draft: PreferencesDraft;
  hasPreferenceChanges: boolean;
  isSavingPreferences: boolean;
  onApplyPreset: (preset: (typeof DIGEST_PRESETS)[number]) => void;
  onNumberChange: (key: NumberPreferenceKey, value: number) => void;
  onReset: () => void;
  onSave: () => void;
  onToggle: (key: BooleanPreferenceKey, value: boolean) => void;
}

function NotificationPreferencesForm({
  draft,
  hasPreferenceChanges,
  isSavingPreferences,
  onApplyPreset,
  onNumberChange,
  onReset,
  onSave,
  onToggle,
}: NotificationPreferencesFormProps) {
  return (
    <div className="space-y-3">
      <CategoryToggleRows draft={draft} onToggle={onToggle} />

      <div className="rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-[10px] text-neutral-400">
        Group notifications into digest emails to reduce send volume. Daily cap applies per owner.
      </div>

      <DigestPresetButtons onApplyPreset={onApplyPreset} />
      <DigestNumberFields draft={draft} onNumberChange={onNumberChange} />

      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
        Potential max volume: {draft.maxEmailsPerDay * DAYS_PER_WEEK} emails/week
      </p>

      <PreferenceActionButtons
        hasPreferenceChanges={hasPreferenceChanges}
        isSavingPreferences={isSavingPreferences}
        onReset={onReset}
        onSave={onSave}
      />
    </div>
  );
}

export function NotificationPreferencesPanel() {
  const preferences = useQuery(api.queries.notifications.getMyNotificationPreferences, {});
  const updatePreferences = useMutation(
    api.mutations.notifications.updateMyNotificationPreferences
  );
  const [draftState, dispatchDraft] = useReducer(preferencesDraftReducer, INITIAL_DRAFT_STATE);
  const baselinePreferences = useMemo(() => getBaselinePreferences(preferences), [preferences]);
  const baselineKey = useMemo(
    () => (baselinePreferences ? getDraftKey(baselinePreferences) : null),
    [baselinePreferences]
  );
  const draft = resolveDraft(draftState, baselinePreferences, baselineKey);
  const hasPreferenceChanges = baselinePreferences
    ? !areDraftsEqual(baselinePreferences, draft)
    : false;

  const requireLoadedBaseline = () => {
    if (!baselinePreferences || !baselineKey) {
      return null;
    }

    return { baseline: baselinePreferences, baselineKey };
  };

  const handleToggle = (key: BooleanPreferenceKey, value: boolean) => {
    const loaded = requireLoadedBaseline();
    if (!loaded) return;

    dispatchDraft({
      type: "setBoolean",
      key,
      value,
      baselineKey: loaded.baselineKey,
      currentDraft: draft,
    });
  };

  const handleNumberChange = (key: NumberPreferenceKey, value: number) => {
    const loaded = requireLoadedBaseline();
    if (!loaded) return;

    dispatchDraft({
      type: "setNumber",
      key,
      value,
      baselineKey: loaded.baselineKey,
      currentDraft: draft,
    });
  };

  const handleApplyPreset = (preset: (typeof DIGEST_PRESETS)[number]) => {
    const loaded = requireLoadedBaseline();
    if (!loaded) return;

    dispatchDraft({
      type: "applyPreset",
      preset,
      baselineKey: loaded.baselineKey,
      currentDraft: draft,
    });

    toast.success(
      `${preset.label} preset applied: ${preset.digestWindowMinutes}m, ${preset.maxDigestItems} items, ${preset.maxEmailsPerDay}/day.`
    );
  };

  const handleReset = () => {
    const loaded = requireLoadedBaseline();
    if (!loaded) return;

    dispatchDraft({
      type: "reset",
      baseline: loaded.baseline,
      baselineKey: loaded.baselineKey,
    });
  };

  const handleSavePreferences = async () => {
    if (!preferences) {
      return;
    }

    const sanitizedDigestWindow = clampNumber(
      draft.digestWindowMinutes,
      NOTIFICATION_MIN_DIGEST_WINDOW_MINUTES,
      NOTIFICATION_MAX_DIGEST_WINDOW_MINUTES
    );
    const sanitizedMaxDigestItems = clampNumber(
      draft.maxDigestItems,
      NOTIFICATION_MIN_DIGEST_ITEMS,
      NOTIFICATION_MAX_DIGEST_ITEMS
    );
    const sanitizedMaxEmailsPerDay = clampNumber(
      draft.maxEmailsPerDay,
      NOTIFICATION_MIN_EMAILS_PER_DAY,
      NOTIFICATION_MAX_EMAILS_PER_DAY
    );

    dispatchDraft({ type: "setSaving", isSavingPreferences: true });
    try {
      await updatePreferences({
        emailEnabled: draft.emailEnabled,
        defaultDigestWindowMinutes: sanitizedDigestWindow,
        defaultMaxDigestItems: sanitizedMaxDigestItems,
        maxEmailsPerDay: sanitizedMaxEmailsPerDay,
        categoryPreferences: [
          { category: NOTIFICATION_CATEGORY_STARS, emailEnabled: draft.starsEmailEnabled },
          { category: NOTIFICATION_CATEGORY_PROFILES, emailEnabled: draft.profilesEmailEnabled },
          { category: NOTIFICATION_CATEGORY_GENERAL, emailEnabled: draft.generalEmailEnabled },
        ],
      });
      toast.success("Notification settings saved.");
    } catch (error) {
      captureUserActionError("update_notification_preferences", error, {
        emailEnabled: draft.emailEnabled,
        starsEmailEnabled: draft.starsEmailEnabled,
        profilesEmailEnabled: draft.profilesEmailEnabled,
        generalEmailEnabled: draft.generalEmailEnabled,
      });
      toast.error(error instanceof Error ? error.message : "Failed to save notification settings.");
    } finally {
      dispatchDraft({ type: "setSaving", isSavingPreferences: false });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-2">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
          <Settings2 className="size-5 text-th-accent-1" />
          Notification Settings
        </h2>
      </div>

      <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-5">
        <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
          Delivery Preferences
        </p>

        {preferences === undefined ? (
          <PreferenceSkeleton />
        ) : (
          <NotificationPreferencesForm
            draft={draft}
            hasPreferenceChanges={hasPreferenceChanges}
            isSavingPreferences={draftState.isSavingPreferences}
            onApplyPreset={handleApplyPreset}
            onNumberChange={handleNumberChange}
            onReset={handleReset}
            onSave={handleSavePreferences}
            onToggle={handleToggle}
          />
        )}
      </div>
    </div>
  );
}
