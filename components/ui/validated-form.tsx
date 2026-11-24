"use client";

import {
  createContext,
  useContext,
  useState,
  type FormEvent,
  type FormHTMLAttributes,
  type SubmitEvent,
} from "react";

import {
  EMAIL_PATTERN,
  MAX_PDF_BYTES,
  isPhone,
  type FieldErrors,
} from "@/lib/validation";

/**
 * One way of validating every form in the workspace.
 *
 * The browser's own bubbles ("Please fill out this field") are switched off
 * with `noValidate`: they disappear on their own, cannot be styled, and speak
 * the browser's language rather than the workspace's. Instead each problem is
 * written under its field, the first one gets focus, and once a form has been
 * submitted the messages update as the Admin types.
 *
 * The rules come from attributes on the controls, so a form only declares
 * what it needs:
 *
 *   required, type="email", type="date" + min, accept=".pdf"
 *   data-max="160"            longest value, in characters
 *   data-kind="phone"         phone number check
 *   data-max-bytes="…"        file size limit (PDF inputs default to 20 MB)
 *   data-msg-required="…"     a better sentence than "X is required."
 *   data-msg-min="…"          for a date before `min`
 *
 * Errors the server finds come in through `serverErrors` and are shown the
 * same way, so the Admin never has to tell the two apart.
 */

const ErrorsContext = createContext<FieldErrors>({});

export function useFieldError(name: string | undefined): string | undefined {
  const errors = useContext(ErrorsContext);
  return name ? errors[name] : undefined;
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isControl(element: Element | null): element is Control {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  );
}

/** The words the Admin sees next to the field, without the asterisk. */
function labelOf(control: Control): string {
  const label = control.closest("label");
  const text =
    label?.querySelector("[data-field-label]")?.textContent ??
    control.getAttribute("aria-label") ??
    label?.textContent ??
    "";
  return text.replace("*", "").trim() || "This field";
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** The message for one control, or null when it is fine. */
export function checkControl(control: Control): string | null {
  if (control.disabled || !control.name) return null;

  const label = labelOf(control);
  const data = control.dataset;

  if (control instanceof HTMLInputElement && control.type === "file") {
    const file = control.files?.[0];
    if (!file) {
      return control.required ? (data.msgRequired ?? "Choose a PDF file to upload.") : null;
    }
    const wantsPdf = /pdf/i.test(control.accept);
    if (wantsPdf && !/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      return `“${file.name}” is not a PDF. Only PDF files can be uploaded.`;
    }
    const maxBytes = Number(data.maxBytes ?? (wantsPdf ? MAX_PDF_BYTES : 0));
    if (maxBytes && file.size > maxBytes) {
      const size = (file.size / 1_048_576).toFixed(1);
      const limit = Math.round(maxBytes / 1_048_576);
      return `“${file.name}” is ${size} MB. Files can be at most ${limit} MB.`;
    }
    return null;
  }

  if (control instanceof HTMLInputElement && control.type === "checkbox") {
    return control.required && !control.checked
      ? (data.msgRequired ?? "Tick this box to continue.")
      : null;
  }

  // A date the browser could not read reports badInput with an empty value.
  if (control instanceof HTMLInputElement && control.validity.badInput) {
    return control.type === "date" ? "Enter a valid date." : `${label} is not valid.`;
  }

  const value = control.value.trim();

  if (!value) {
    if (!control.required) return null;
    if (data.msgRequired) return data.msgRequired;
    return control instanceof HTMLSelectElement
      ? `Choose ${label.toLowerCase()}.`
      : `${label} is required.`;
  }

  const max = Number(data.max ?? 0);
  if (max && value.length > max) {
    return `${label} can be at most ${plural(max, "character")}; it has ${value.length}.`;
  }

  if (control instanceof HTMLInputElement) {
    if (control.type === "email" && !EMAIL_PATTERN.test(value)) {
      return "Enter a valid email address, like name@example.com.";
    }
    if (data.kind === "phone" && !isPhone(value)) {
      return "Enter a phone number with at least six digits, like +383 44 123 456.";
    }
    if (control.type === "date" && control.min && value < control.min) {
      return data.msgMin ?? "Choose today or a later date.";
    }
  }

  return null;
}

function checkForm(form: HTMLFormElement): FieldErrors {
  const errors: FieldErrors = {};
  for (const element of Array.from(form.elements)) {
    if (!isControl(element) || errors[element.name]) continue;
    const message = checkControl(element);
    if (message) errors[element.name] = message;
  }
  return errors;
}

export function ValidatedForm({
  serverErrors,
  children,
  onSubmit,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & { serverErrors?: FieldErrors }) {
  const [errors, setErrors] = useState<FieldErrors>(serverErrors ?? {});
  const [submitted, setSubmitted] = useState(false);

  // A new answer from the server replaces whatever the browser last showed.
  const [lastServerErrors, setLastServerErrors] = useState(serverErrors);
  if (serverErrors !== lastServerErrors) {
    setLastServerErrors(serverErrors);
    setErrors(serverErrors ?? {});
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const found = checkForm(form);
    setErrors(found);
    setSubmitted(true);

    const first = Object.keys(found)[0];
    if (first) {
      // Stops the form's action as well as the browser's submit.
      event.preventDefault();
      const control = form.elements.namedItem(first);
      if (control instanceof HTMLElement) {
        control.focus();
        control.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return;
    }
    onSubmit?.(event);
  }

  // Before the first submit only a field that already shows an error is
  // re-checked, so nobody is told off for a field they have not finished.
  function handleEdit(event: FormEvent<HTMLFormElement>) {
    const control = event.target as Element;
    if (!isControl(control) || !control.name) return;
    if (!submitted && !errors[control.name]) return;

    const message = checkControl(control);
    setErrors((current) => {
      if ((current[control.name] ?? null) === message) return current;
      const next = { ...current };
      if (message) next[control.name] = message;
      else delete next[control.name];
      return next;
    });
  }

  return (
    <ErrorsContext.Provider value={errors}>
      <form
        {...props}
        noValidate
        onSubmit={handleSubmit}
        onInput={handleEdit}
        onChange={handleEdit}
      >
        {children}
      </form>
    </ErrorsContext.Provider>
  );
}
