import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "default" | "primary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  default:
    "border-line-strong bg-surface text-fg hover:bg-surface-2 active:bg-surface-2",
  primary:
    "border-accent bg-accent text-accent-fg hover:border-accent-hover hover:bg-accent-hover",
  ghost:
    "border-transparent bg-transparent text-muted hover:bg-surface-2 hover:text-fg",
  danger: "border-danger bg-danger text-white hover:brightness-110",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "gap-1.5 px-2.5 py-1 text-[13px]",
  md: "gap-2 px-3.5 py-2",
  lg: "gap-2 px-5 py-3 text-[15px]",
};

export function buttonClasses(
  variant: ButtonVariant = "default",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(
    "inline-flex cursor-pointer items-center justify-center rounded-lg border font-medium leading-tight whitespace-nowrap transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-45",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "default",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}

/** A square control that carries only an icon, so it always needs a label. */
export function IconButton({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return (
    <button
      type={type}
      className={cn(
        "relative grid size-9 cursor-pointer place-items-center rounded-lg border border-transparent text-muted transition-colors hover:bg-surface-2 hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}
