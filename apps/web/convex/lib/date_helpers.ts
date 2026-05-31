/**
 * Returns the Monday 00:00 UTC epoch‑ms for the ISO week containing
 * the given timestamp. Used to bucket weekly stars.
 */
export function getWeekStart(timestamp: number = Date.now()): number {
  const d = new Date(timestamp);
  const day = d.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}
