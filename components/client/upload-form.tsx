"use client";

import { useActionState, useRef, useState } from "react";

import { submitClientUpload } from "@/app/actions/client-upload";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * The client's upload box.
 *
 * Checks that can be made in the browser happen here so the answer is instant,
 * and the server repeats every one of them, because nothing arriving from a
 * client page is trusted.
 */
export function UploadForm({ token }: { token: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, pending] = useActionState(
    async (
      _previous: Awaited<ReturnType<typeof submitClientUpload>> | null,
      formData: FormData,
    ) => submitClientUpload(token, formData),
    null,
  );

  function choose(next: File | null) {
    setLocalError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!/\.pdf$/i.test(next.name) && next.type !== "application/pdf") {
      setLocalError(`“${next.name}” is not a PDF. Please choose a PDF file.`);
      setFile(null);
      return;
    }
    if (next.size > MAX_BYTES) {
      setLocalError(
        `“${next.name}” is ${formatBytes(next.size)}. Files must be 20 MB or smaller.`,
      );
      setFile(null);
      return;
    }
    setFile(next);
  }

  if (state?.ok) {
    return (
      <p className="flex items-center gap-2.5 font-medium text-ok">
        <Icon name="check" />
        Uploaded. Your lawyer has been notified and will review it.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(event) => choose(event.target.files?.[0] ?? null)}
      />

      {file ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-line px-3 py-2.5">
          <Icon name="file" className="shrink-0" />
          <span className="min-w-0 flex-1 break-words">
            {file.name} <span className="text-muted">· {formatBytes(file.size)}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              choose(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="cursor-pointer font-medium text-accent underline underline-offset-[3px]"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer.files?.[0] ?? null;
            if (dropped && inputRef.current) {
              const transfer = new DataTransfer();
              transfer.items.add(dropped);
              inputRef.current.files = transfer.files;
            }
            choose(dropped);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1 rounded-card border-[1.5px] border-dashed px-4 py-6 text-center text-muted transition-colors",
            dragging
              ? "border-accent bg-accent-soft"
              : "border-line-strong bg-bg hover:border-accent hover:bg-accent-soft",
          )}
        >
          <Icon name="upload" className="size-6 text-accent" />
          <b className="text-fg">Choose a PDF</b>
          <span>or drag it here</span>
          <small>PDF only, up to 20 MB</small>
        </button>
      )}

      {localError ?? (state && !state.ok ? state.message : null) ? (
        <p role="alert" className="font-medium text-danger">
          {localError ?? (state && !state.ok ? state.message : null)}
        </p>
      ) : null}

      {file ? (
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={pending}>
            <Icon name="upload" />
            {pending ? "Uploading…" : "Upload"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
