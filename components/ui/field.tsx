"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { useFieldError } from "@/components/ui/validated-form";
import { cn } from "@/lib/cn";

/**
 * A labelled control, and the place its error appears.
 *
 * The control inside is found by its `name`, so a form passes nothing extra:
 * inside a `ValidatedForm` the message for that name is written under the
 * control, which is marked `aria-invalid` and pointed at the message, so a
 * screen reader announces it with the field.
 *
 * `required` adds the asterisk. The control's own `required` attribute is what
 * the rule reads; the asterisk is for the eye and hidden from screen readers.
 */
export function Field({
  label,
  hint,
  required,
  hideLabel,
  children,
  className,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  /** Keep the label for screen readers only, where the layout has no room. */
  hideLabel?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const [control, setControl] = useState<HTMLElement | null>(null);
  const error = useFieldError(control?.getAttribute("name") ?? undefined);

  useEffect(() => {
    if (!control) return;
    const described = [error ? errorId : null, hint ? hintId : null]
      .filter(Boolean)
      .join(" ");
    if (described) control.setAttribute("aria-describedby", described);
    else control.removeAttribute("aria-describedby");
    if (error) control.setAttribute("aria-invalid", "true");
    else control.removeAttribute("aria-invalid");
  }, [control, error, errorId, hint, hintId]);

  return (
    <label
      ref={(node) => {
        const found =
          node?.querySelector<HTMLElement>("input, select, textarea") ?? null;
        if (found !== control) setControl(found);
      }}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <span
        data-field-label
        className={cn("text-[13px] font-medium", hideLabel && "sr-only")}
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        ) : null}
      </span>
      {children}
      {hint ? (
        <small id={hintId} className="text-[12.5px] text-muted">
          {hint}
        </small>
      ) : null}
      {error ? (
        <small
          id={errorId}
          className="flex items-start gap-1.5 text-[12.5px] font-medium text-danger"
        >
          <Icon name="alert" className="mt-px size-3.5 shrink-0" />
          {error}
        </small>
      ) : null}
    </label>
  );
}
