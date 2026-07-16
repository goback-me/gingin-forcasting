/**
 * Gingin locks production every Friday to cut meat Saturday, stocking the
 * following Monday. This returns the next lock date and the Monday it's
 * stocking for, so the UI can show "order/lock by" instead of leaving it
 * implicit in a table of numbers.
 */
export function getNextLockInfo(now: Date = new Date()) {
  const day = now.getUTCDay(); // 0=Sun..6=Sat
  const daysUntilFriday = (5 - day + 7) % 7;
  const lockDate = new Date(now);
  // If today IS Friday, treat today as the lock day (not next week's).
  lockDate.setUTCDate(now.getUTCDate() + (daysUntilFriday === 0 ? 0 : daysUntilFriday));

  const weekStart = new Date(lockDate);
  const daysUntilMonday = ((1 - lockDate.getUTCDay() + 7) % 7) || 7; // the Monday AFTER the lock date
  weekStart.setUTCDate(lockDate.getUTCDate() + daysUntilMonday);

  return {
    lockDate: lockDate.toISOString().slice(0, 10),
    weekStart: weekStart.toISOString().slice(0, 10),
  };
}
