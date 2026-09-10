export type RecurringObligationFrequency = "weekly" | "monthly" | "yearly";

export type RecurringObligationSchedule = Readonly<{
  frequency: RecurringObligationFrequency;
  firstDueDate: string;
  endDate?: string | null;
}>;

export function generateRecurringDueDates(schedule: RecurringObligationSchedule, throughDate: string, fromDate?: string): string[] {
  const first = parseCalendarDate(schedule.firstDueDate);
  const through = parseCalendarDate(throughDate);
  const from = fromDate ? parseCalendarDate(fromDate) : first;
  const end = schedule.endDate ? parseCalendarDate(schedule.endDate) : null;
  if (end && end < first) throw new Error("Recurring obligation end date precedes first due date");
  if (through < first || through < from) return [];
  const limit = end && end < through ? end : through;
  const result: string[] = [];
  let occurrence = firstOccurrenceOnOrAfter(first, from, schedule.frequency);
  while (occurrence <= limit) {
    result.push(toCalendarDate(occurrence));
    occurrence = nextRecurringDate(occurrence, first, schedule.frequency);
  }
  return result;
}

function firstOccurrenceOnOrAfter(first: Date, from: Date, frequency: RecurringObligationFrequency): Date {
  if (from <= first) return first;
  let result = new Date(first);
  if (frequency === "weekly") {
    const days = Math.ceil((from.getTime() - first.getTime()) / 86_400_000);
    result.setUTCDate(result.getUTCDate() + Math.ceil(days / 7) * 7);
  } else if (frequency === "monthly") {
    const months = (from.getUTCFullYear() - first.getUTCFullYear()) * 12 + from.getUTCMonth() - first.getUTCMonth();
    result = addMonthsPreservingDay(first, Math.max(0, months - 1));
    while (result < from) result = nextRecurringDate(result, first, frequency);
  } else {
    const years = from.getUTCFullYear() - first.getUTCFullYear();
    result = addYearsPreservingDay(first, Math.max(0, years - 1));
    while (result < from) result = nextRecurringDate(result, first, frequency);
  }
  return result;
}

function addMonthsPreservingDay(anchor: Date, months: number): Date {
  const targetMonth = anchor.getUTCMonth() + months;
  const year = anchor.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const day = Math.min(anchor.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day));
}

function addYearsPreservingDay(anchor: Date, years: number): Date {
  const year = anchor.getUTCFullYear() + years;
  const day = Math.min(anchor.getUTCDate(), new Date(Date.UTC(year, anchor.getUTCMonth() + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, anchor.getUTCMonth(), day));
}

export function nextRecurringDate(current: Date, anchor: Date, frequency: RecurringObligationFrequency): Date {
  if (frequency === "weekly") {
    const next = new Date(current);
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  const target = frequency === "monthly"
    ? new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1))
    : new Date(Date.UTC(current.getUTCFullYear() + 1, anchor.getUTCMonth(), 1));
  const daysInMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(anchor.getUTCDate(), daysInMonth));
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
