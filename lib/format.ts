/**
 * Formatting shared by every screen.
 *
 * Dates are rendered in en-GB with an explicit timezone so the server and the
 * browser agree, which otherwise shows up as a hydration mismatch on dates.
 */

const TIME_ZONE = "Europe/London";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const shortDateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TIME_ZONE,
});

const monthFmt = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: TIME_ZONE,
});

const dayNumberFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  timeZone: TIME_ZONE,
});

const weekdayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  timeZone: TIME_ZONE,
});

export function formatDate(date: Date | null | undefined): string {
  return date ? dateFmt.format(date) : "—";
}

export function formatShortDate(date: Date): string {
  return shortDateFmt.format(date);
}

export function formatDateTime(date: Date | null | undefined): string {
  return date ? `${shortDateFmt.format(date)}, ${timeFmt.format(date)}` : "—";
}

export function formatTime(date: Date): string {
  return timeFmt.format(date);
}

export function formatWeekday(date: Date): string {
  return weekdayFmt.format(date);
}

/** The month and day used by the small calendar tile. */
export function calendarParts(date: Date): { month: string; day: string } {
  return { month: monthFmt.format(date), day: dayNumberFmt.format(date) };
}

/** Whole days from today to `date`, negative when it has passed. */
export function daysUntil(date: Date, now: Date = new Date()): number {
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86_400_000);
}

export type DueTone = "late" | "soon" | "normal";

/**
 * Turns a date into the phrase the workspace uses everywhere, plus the tone
 * that colours it. Deadlines are the thing a firm gets wrong, so they are never
 * shown as a bare date when they are close.
 */
export function dueLabel(
  date: Date,
  now: Date = new Date(),
): { text: string; tone: DueTone } {
  const days = daysUntil(date, now);
  if (days < 0) {
    const n = Math.abs(days);
    return { text: `Overdue by ${n} day${n === 1 ? "" : "s"}`, tone: "late" };
  }
  if (days === 0) return { text: "Due today", tone: "soon" };
  if (days === 1) return { text: "Due tomorrow", tone: "soon" };
  if (days <= 3) return { text: `In ${days} days`, tone: "soon" };
  if (days <= 30) return { text: `In ${days} days`, tone: "normal" };
  return { text: formatDate(date), tone: "normal" };
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** The document name without its .pdf suffix, for headings and emails. */
export function documentTitle(name: string): string {
  return name.replace(/\.pdf$/i, "");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

// --- Labels for enum values -------------------------------------------------

export const matterStatusLabel = {
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  CLOSED: "Closed",
} as const;

export const priorityLabel = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
} as const;

export const folderLabel = {
  CONTRACTS: "Contracts",
  CLIENT_UPLOADS: "Client uploads",
  SIGNED: "Signed",
} as const;

/** What the Admin needs to read at a glance, not the raw enum name. */
export const requestStatusLabel = {
  PENDING: "Waiting for client",
  SUBMITTED: "Needs review",
  CHANGES_REQUESTED: "Changes requested",
  ACCEPTED: "Accepted",
  CANCELLED: "Cancelled",
} as const;

export const signatureStatusLabel = {
  SENT: "Sent",
  VIEWED: "Opened",
  STARTED: "Signing in progress",
  SIGNED: "Signed",
  REVOKED: "Revoked",
  EXPIRED: "Expired",
} as const;
