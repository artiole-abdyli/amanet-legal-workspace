"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";

/** Copies a secure link, for handing it to a client by another channel. */
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={buttonClasses("default", "sm")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard access can be refused; the link is still on screen.
        }
      }}
    >
      <Icon name={copied ? "check" : "link"} />
      <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
    </button>
  );
}
