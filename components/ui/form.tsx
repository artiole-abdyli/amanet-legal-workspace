import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 py-2 text-fg focus:border-muted focus:outline-none aria-[invalid=true]:border-danger aria-[invalid=true]:focus:border-danger";

export function FormPage({
  backHref,
  backLabel,
  title,
  description,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-[680px] flex-col gap-5">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 self-start text-muted hover:text-fg"
      >
        <Icon name="arrow" className="size-4 rotate-180" />
        {backLabel}
      </Link>

      <div>
        <h1 className="font-serif text-[26px] leading-tight font-semibold tracking-[-0.015em]">
          {title}
        </h1>
        {description ? <p className="mt-1 text-muted">{description}</p> : null}
      </div>

      {children}
    </div>
  );
}

export { Field } from "@/components/ui/field";
export { ValidatedForm } from "@/components/ui/validated-form";

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(CONTROL, props.className)} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea {...props} className={cn(CONTROL, "resize-y", props.className)} />
  );
}

export function FormCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      {children}
    </div>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-end gap-2.5 border-t border-line pt-4">
      {children}
    </div>
  );
}
