"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { signAsFirm, type FirmSignState } from "@/app/actions/firm-sign";
import { Icon } from "@/components/icons";
import {
  SignaturePad,
  type SignatureValue,
} from "@/components/signature-pad";
import { Button, buttonClasses } from "@/components/ui/button";
import { Callout } from "@/components/ui/card";

export function FirmSignForm({
  matterId,
  documentId,
  signerName,
  firmName,
  backHref,
}: {
  matterId: string;
  documentId: string;
  signerName: string;
  firmName: string;
  backHref: string;
}) {
  const [signature, setSignature] = useState<SignatureValue>(null);
  const [consent, setConsent] = useState(false);

  const [state, formAction, pending] = useActionState<FirmSignState, FormData>(
    signAsFirm.bind(null, matterId, documentId),
    null,
  );

  const ready = Boolean(signature) && consent;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-5">
        <SignaturePad
          signerName={signerName}
          value={signature}
          onChange={setSignature}
        />

        <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px]">
          <input
            type="checkbox"
            name="consent"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-0.5 size-[18px] shrink-0 accent-[var(--accent)]"
          />
          <span>
            I confirm I am authorised to sign this document on behalf of{" "}
            {firmName}.
          </span>
        </label>

        <Callout>
          A new signed PDF is written to the Signed folder with a certificate of
          completion. The version you are signing is kept exactly as it is.
        </Callout>

        {state?.error ? (
          <p role="alert" className="font-medium text-danger">
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2.5 border-t border-line pt-4">
          <Link href={backHref} className={buttonClasses()}>
            Cancel
          </Link>
          <Button
            type="submit"
            variant="primary"
            disabled={!ready || pending}
          >
            <Icon name="pen" />
            {pending ? "Signing…" : "Sign document"}
          </Button>
        </div>

        {!ready ? (
          <p aria-live="polite" className="text-right text-[12.5px] text-muted">
            {!signature
              ? "Draw or type your signature to continue."
              : "Tick the box to confirm you are authorised to sign."}
          </p>
        ) : null}
      </div>
    </form>
  );
}
