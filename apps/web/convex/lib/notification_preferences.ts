import type { Doc } from "../_generated/dataModel";
import {
  DEFAULT_MAX_EMAILS_PER_DAY,
  MAX_DIGEST_ITEMS_IN_EMAIL,
  NOTIFICATION_DIGEST_WINDOW_MS,
  normalizeDigestWindowMs,
  normalizeMaxDigestItems,
  normalizeMaxEmailsPerDay,
} from "./notification_digests";

export interface NotificationCategoryPreferenceInput {
  category: string;
  emailEnabled?: boolean;
  digestWindowMs?: number;
  maxDigestItems?: number;
}

export interface ResolvedNotificationPreferences {
  emailEnabled: boolean;
  digestWindowMs: number;
  maxDigestItems: number;
  maxEmailsPerDay: number;
}

type NotificationPreferencesDoc = Doc<"notificationPreferences"> | null | undefined;

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

function findCategoryPreference(preferences: NotificationPreferencesDoc, category: string) {
  if (!preferences?.categoryPreferences?.length) {
    return undefined;
  }

  const normalized = normalizeCategory(category);
  return preferences.categoryPreferences.find(
    (item) => normalizeCategory(item.category) === normalized
  );
}

export function resolveNotificationPreferences(
  preferences: NotificationPreferencesDoc,
  category: string
): ResolvedNotificationPreferences {
  const categoryPreference = findCategoryPreference(preferences, category);

  const defaultEmailEnabled = preferences?.emailEnabled ?? true;
  const emailEnabled = categoryPreference?.emailEnabled ?? defaultEmailEnabled;

  const defaultDigestWindowMs = normalizeDigestWindowMs(
    preferences?.defaultDigestWindowMs ?? NOTIFICATION_DIGEST_WINDOW_MS
  );
  const digestWindowMs = normalizeDigestWindowMs(
    categoryPreference?.digestWindowMs ?? defaultDigestWindowMs
  );

  const defaultMaxDigestItems = normalizeMaxDigestItems(
    preferences?.defaultMaxDigestItems ?? MAX_DIGEST_ITEMS_IN_EMAIL
  );
  const maxDigestItems = normalizeMaxDigestItems(
    categoryPreference?.maxDigestItems ?? defaultMaxDigestItems
  );

  const maxEmailsPerDay = normalizeMaxEmailsPerDay(
    preferences?.maxEmailsPerDay ?? DEFAULT_MAX_EMAILS_PER_DAY
  );

  return {
    emailEnabled,
    digestWindowMs,
    maxDigestItems,
    maxEmailsPerDay,
  };
}

export function sanitizeCategoryPreferences(
  input: NotificationCategoryPreferenceInput[] | undefined
): NotificationCategoryPreferenceInput[] {
  if (!input) {
    return [];
  }

  const deduped = new Map<string, NotificationCategoryPreferenceInput>();
  for (const item of input) {
    const normalizedCategory = normalizeCategory(item.category);
    if (!normalizedCategory) {
      continue;
    }

    const normalized: NotificationCategoryPreferenceInput = {
      category: normalizedCategory,
      emailEnabled: item.emailEnabled,
      digestWindowMs:
        item.digestWindowMs === undefined
          ? undefined
          : normalizeDigestWindowMs(item.digestWindowMs),
      maxDigestItems:
        item.maxDigestItems === undefined
          ? undefined
          : normalizeMaxDigestItems(item.maxDigestItems),
    };

    if (
      normalized.emailEnabled === undefined &&
      normalized.digestWindowMs === undefined &&
      normalized.maxDigestItems === undefined
    ) {
      continue;
    }

    deduped.set(normalizedCategory, normalized);
  }

  return Array.from(deduped.values()).sort((a, b) => a.category.localeCompare(b.category));
}
