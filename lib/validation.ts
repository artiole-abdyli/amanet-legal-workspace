/**
 * Field rules shared by the browser and the server.
 *
 * The forms check these as the Admin types, so mistakes are caught at once and
 * explained next to the field. The server actions check them again, because a
 * form can be posted without the page. Keeping both on one list is what stops
 * the two from drifting apart.
 *
 * Nothing here imports server code, so client components can use it.
 */

/** Longest value each kind of field accepts, in characters. */
export const LIMITS = {
  title: 160,
  name: 120,
  email: 254,
  phone: 40,
  label: 80,
  description: 2000,
  message: 2000,
  note: 5000,
  reason: 300,
} as const;

/** Largest PDF a form accepts, in bytes. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/**
 * Deliberately simple: one @, something either side, and a dot in the domain.
 * The browser's own check accepts `name@localhost`, which can never receive a
 * secure link, so this is the stricter of the two.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Digits, spaces and the usual separators; at least six digits in all. */
export const PHONE_PATTERN = /^\+?[\d\s().-]+$/;

export function isEmail(value: string): boolean {
  return value.length <= LIMITS.email && EMAIL_PATTERN.test(value);
}

export function isPhone(value: string): boolean {
  return (
    value.length <= LIMITS.phone &&
    PHONE_PATTERN.test(value) &&
    value.replace(/\D/g, "").length >= 6
  );
}

/** Errors keyed by the field's `name`, as the forms render them. */
export type FieldErrors = Record<string, string>;

/** Today as yyyy-mm-dd in the browser's or server's local time. */
export function todayInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Reads a yyyy-mm-dd value from a date input. Noon, so a timezone shift can
 * never move it to the day before.
 */
export function parseDateInput(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isPastDateInput(raw: string): boolean {
  return raw < todayInput();
}

/**
 * Server-side reading of a form, collecting every problem rather than stopping
 * at the first, so the Admin sees all of them at once.
 */
export function createChecker(formData: FormData) {
  const errors: FieldErrors = {};

  function text(
    name: string,
    options: { required?: string; max: number; label: string },
  ): string {
    const value = String(formData.get(name) ?? "").trim();
    if (!value && options.required) errors[name] = options.required;
    else if (value.length > options.max) {
      errors[name] = `${options.label} can be at most ${options.max} characters.`;
    }
    return value;
  }

  function email(name: string, options: { required: string }): string {
    const value = String(formData.get(name) ?? "").trim();
    if (!value) errors[name] = options.required;
    else if (!isEmail(value)) {
      errors[name] = "Enter a valid email address, like name@example.com.";
    }
    return value;
  }

  function date(
    name: string,
    options: { required?: string; notPast?: string } = {},
  ): Date | null {
    const raw = String(formData.get(name) ?? "");
    if (!raw) {
      if (options.required) errors[name] = options.required;
      return null;
    }
    const parsed = parseDateInput(raw);
    if (!parsed) errors[name] = "Enter a valid date.";
    else if (options.notPast && isPastDateInput(raw)) errors[name] = options.notPast;
    return parsed;
  }

  function fail(name: string, message: string) {
    errors[name] = message;
  }

  return {
    text,
    email,
    date,
    fail,
    errors,
    get ok() {
      return Object.keys(errors).length === 0;
    },
  };
}
