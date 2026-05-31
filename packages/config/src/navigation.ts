import { getI18n } from "@stackmatch/localization";
import type { NavItem } from "@stackmatch/types/navigation";

const i18n = getI18n();

export const DOCS_NAV: NavItem[] = i18n.navigation.docs.items;

export const LEADERBOARD_NAV: NavItem[] = i18n.navigation.leaderboard.items;
