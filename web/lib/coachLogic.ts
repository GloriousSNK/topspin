export function practiceDayStreak(dates: string[], now = new Date()): number {
  const days = new Set(dates.map((value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  }).filter(Boolean));
  if (!days.size) return 0;
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const key = (date: Date) => `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  if (!days.has(key(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(key(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
