"use client";

import { useActionState, useState, useTransition } from "react";

import { markStarted, submitSignature } from "@/app/actions/sign";
import { ClientState } from "@/components/client/shell";
import { Icon } from "@/components/icons";
import {
  SignaturePad,
  type SignatureValue,
} from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { firstName } from "@/lib/format";

type Step = "review" | "sign";

export function SignFlow({
  token,
  signerName,
  signerEmail,
  documentName,
  matterReference,
  pdfUrl,
}: {
  token: string;
  signerName: string;
  signerEmail: string;
  documentName: string;
  matterReference: string;
  pdfUrl: string;
}) {
  const [step, setStep] = useState<Step>("review");
  const [signature, setSignature] = useState<SignatureValue>(null);
  const [consent, setConsent] = useState(false);
  const [, startTransition] = useTransition();

  const [state, formAction, pending] = useActionState(
    async (
      _previous: Awaited<ReturnType<typeof submitSignature>> | null,
      formData: FormData,
    ) => submitSignature(token, formData),
    null,
  );

  function noteStarted() {
    startTransition(async () => {
      await markStarted(token);
    });
  }

  if (state?.ok) {
    return (
      <ClientState
        tone="ok"
        icon="check"
        title={`Thank you, ${firstName(signerName)}. It is signed.`}
        extra={
          <dl className="mt-2 w-full max-w-[460px] rounded-card border border-line bg-bg px-4 py-3.5 text-left">
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-muted">Document</dt>
              <dd className="min-w-0 text-right">{documentName}</dd>
            </div>
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-muted">Matter</dt>
              <dd className="font-mono text-[13px]">{matterReference}</dd>
            </div>
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-muted">Copy sent to</dt>
              <dd className="min-w-0 text-right font-mono text-[13px] break-all">
                {signerEmail}
              </dd>
            </div>
          </dl>
        }
      >
        Harlow &amp; Vance has been notified. A signed copy with its certificate
        of completion has been emailed to you. You can close this page.
      </ClientState>
    );
  }

  const ready = Boolean(signature) && consent;

  return (
    <>
      <ol className="flex gap-2" aria-label="Progress">
        {(["Review", "Sign", "Done"] as const).map((label, index) => {
          const current = step === "review" ? 0 : 1;
          return (
            <li
              key={label}
              className={cn(
                "flex flex-1 items-center gap-2 border-t-[3px] pt-2.5 text-[13px] font-medium",
                index < current && "border-accent text-accent",
                index === current && "border-accent text-fg",
                index > current && "border-line text-faint",
              )}
            >
              <span
                className={cn(
                  "grid size-[22px] shrink-0 place-items-center rounded-full border-[1.5px] text-[11.5px]",
                  index === current
                    ? "border-accent bg-accent text-accent-fg"
                    : index < current
                      ? "border-transparent bg-accent-soft"
                      : "border-current",
                )}
              >
                {index < current ? "✓" : index + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      {step === "review" ? (
        <>
          <div className="overflow-hidden rounded-card border border-line bg-surface-2">
            <iframe
              src={pdfUrl}
              title={`${documentName}, preview`}
              className="h-[62vh] min-h-[420px] w-full"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2.5">
            <a
              href={pdfUrl}
              download
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 py-2 font-medium hover:bg-surface-2"
            >
              <Icon name="download" />
              Download PDF
            </a>
            <Button variant="primary" size="lg" onClick={() => setStep("sign")}>
              Continue to sign
              <Icon name="arrow" />
            </Button>
          </div>
        </>
      ) : (
        <form action={formAction} className="flex flex-col gap-5">
          <section className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-5">
            <SignaturePad
              signerName={signerName}
              value={signature}
              onChange={setSignature}
              onFirstInput={noteStarted}
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
                I agree to sign this document electronically. I understand my
                electronic signature has the same effect as signing by hand.
              </span>
            </label>
          </section>

          {state && !state.ok ? (
            <p role="alert" className="font-medium text-danger">
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <Button type="button" onClick={() => setStep("review")}>
              Back to document
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
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
                : "Tick the box to confirm you agree to sign electronically."}
            </p>
          ) : null}
        </form>
      )}
    </>
  );
}
