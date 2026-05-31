import type { AppCopy, AppLocale } from "@stackmatch/types/localization";
import { en } from "./en";

export const DEFAULT_LOCALE: AppLocale = "en";

export const I18N_BY_LOCALE: Record<AppLocale, AppCopy> = {
  en,
};

export function getI18n(locale: AppLocale = DEFAULT_LOCALE): AppCopy {
  return I18N_BY_LOCALE[locale];
}

export { en };
export type { AppCopy, AppLocale };
