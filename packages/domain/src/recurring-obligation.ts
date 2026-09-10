export type RecurringObligationFrequency = "weekly" | "monthly" | "yearly";

export type RecurringObligationSchedule = Readonly<{
  frequency: RecurringObligationFrequency;
  firstDueDate: string;
  endDate?: string | null;
}>;

export function generateRecurringDueDates(
  schedule: RecurringObligationSchedule,
  throughDate: string,
): string[] {
  const first = parseCalendarDate(schedule.firstDueDate);
  const through = parseCalendarDate(throughDate);
  const end = schedule.endDate ? parseCalendarDate(schedule.endDate) : null;
  if (end && end < first) throw new Error("Recurring obligation end date precedes first due date");
  if (through < first) return [];

  const limit = end && end < through ? end : through;
  const result: string[] = [];
  let occurrence = first;
  while (occurrence <= limit) {
    result.push(toCalendarDate(occurrence));
    occurrence = nextRecurringDate(occurrence, first, schedule.frequency);
  }
  return result;
}

export function nextRecurringDate(
  current: Date,
  anchor: Date,
  frequency: RecurringObligationFrequency,
): Date {
  if (frequency === "weekly") {
    const next = new Date(current);
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  const target = frequency === "monthly"
    ? new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1))
    : new Date(Date.UTC(current.getUTCFullYear() + 1, anchor.getUTCMonth(), 1));
  const daysInMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const anchorDay = anchor.getUTCDate();
  target.setUTCDate(Math.min(anchorDay, daysInMonth));
  return target;
}

function parseCalendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid calendar date: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return date;
}

function toCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
