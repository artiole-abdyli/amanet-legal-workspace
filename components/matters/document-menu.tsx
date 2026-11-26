"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  type DocumentActionState,
  archiveDocument,
  moveDocument,
  renameDocument,
  restoreDocument,
} from "@/app/actions/documents";
import { Icon } from "@/components/icons";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { LIMITS } from "@/lib/validation";

function Problem({ state }: { state: DocumentActionState }) {
  if (!state || state.ok || !state.message) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-[12.5px] text-danger">
      <Icon name="alert" className="mt-0.5 size-3.5 shrink-0" />
      {state.message}
    </p>
  );
}

/** Closes the menu once an action has gone through. */
function useCloseOnSuccess(
  ref: React.RefObject<HTMLDetailsElement | null>,
  ...states: DocumentActionState[]
) {
  useEffect(() => {
    if (states.some((state) => state?.ok)) ref.current?.removeAttribute("open");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, states);
}

/**
 * Rename, move and archive for one document.
 *
 * Each form reports its own refusal next to itself (a name already taken, a
 * file still out for signature), because the reason is what tells the Admin
 * what to do next.
 */
export function DocumentMenu({
  documentId,
  name,
  folder,
}: {
  documentId: string;
  name: string;
  folder: "CONTRACTS" | "CLIENT_UPLOADS" | "SIGNED";
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [renamed, rename, renaming] = useActionState(
    renameDocument.bind(null, documentId),
    null,
  );
  const [moved, move, moving] = useActionState(
    moveDocument.bind(null, documentId),
    null,
  );
  const [archived, archive, archiving] = useActionState(
    archiveDocument.bind(null, documentId),
    null,
  );
  useCloseOnSuccess(ref, renamed, moved, archived);

  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={`Organise ${name}`}
        className={buttonClasses("ghost", "sm")}
      >
        <Icon name="pen" className="size-4" />
      </summary>
      <div className="absolute right-0 z-10 mt-2 flex w-[min(340px,85vw)] flex-col gap-3 rounded-card border border-line bg-surface p-3 shadow-card">
        <form action={rename} className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium" htmlFor={`name-${documentId}`}>
            Name
          </label>
          <div className="flex gap-2">
            <Input
              id={`name-${documentId}`}
              name="name"
              defaultValue={name}
              maxLength={LIMITS.title}
              required
              className="min-w-0 flex-1"
            />
            <Button type="submit" size="sm" disabled={renaming}>
              Rename
            </Button>
          </div>
          <Problem state={renamed} />
        </form>

        {folder === "SIGNED" ? (
          <p className="border-t border-line pt-3 text-[12.5px] text-muted">
            Signed records stay in the Signed folder and cannot be archived.
          </p>
        ) : (
          <>
            <form action={move} className="flex flex-col gap-1.5 border-t border-line pt-3">
              <label className="text-[13px] font-medium" htmlFor={`folder-${documentId}`}>
                Folder
              </label>
              <div className="flex gap-2">
                <Select
                  id={`folder-${documentId}`}
                  name="folder"
                  defaultValue={folder}
                  className="min-w-0 flex-1"
                >
                  <option value="CONTRACTS">Contracts</option>
                  <option value="CLIENT_UPLOADS">Client uploads</option>
                </Select>
                <Button type="submit" size="sm" disabled={moving}>
                  Move
                </Button>
              </div>
              <Problem state={moved} />
            </form>

            <form action={archive} className="flex flex-col gap-1.5 border-t border-line pt-3">
              <p className="text-[12.5px] text-muted">
                Archiving hides the file from the library. Every version is kept
                and it can be restored.
              </p>
              <Button type="submit" variant="danger" size="sm" disabled={archiving}>
                <Icon name="archive" className="size-4" />
                Archive document
              </Button>
              <Problem state={archived} />
            </form>
          </>
        )}
      </div>
    </details>
  );
}

export function RestoreDocumentButton({ documentId }: { documentId: string }) {
  const [state, restore, pending] = useActionState(
    restoreDocument.bind(null, documentId),
    null,
  );
  return (
    <form action={restore} className="flex flex-col items-end gap-1">
      <Button type="submit" size="sm" disabled={pending}>
        Restore
      </Button>
      <Problem state={state} />
    </form>
  );
}
