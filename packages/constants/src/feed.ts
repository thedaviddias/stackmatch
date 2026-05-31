export const FEED_EVENT_HIDE_PREFIX = "__feed_event__:";

/**
 * A discovery feed with fewer than this many matches is treated as "thin" and
 * shown a grow-your-graph nudge so a near-empty feed feels intentional rather
 * than broken.
 */
export const DISCOVERY_THIN_FEED_THRESHOLD = 3;

/**
 * A candidate qualifies for the "Mentors With Your Stack" section when their
 * Stack Score is at least this multiple of the profile owner's Stack Score.
 */
export const MENTOR_STACK_SCORE_MULTIPLIER = 2;
