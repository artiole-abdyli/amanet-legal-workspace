import Link from "next/link";

import { resendSigningLink, revokeSignature } from "@/app/actions/signatures";
import { Icon } from "@/components/icons";
import { Badge, signatureStatusTone } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { VersionTag } from "@/components/ui/meta";
import { Field, Input, ValidatedForm } from "@/components/ui/form";
import { LIMITS } from "@/lib/validation";
import { SignatureStepper } from "@/components/ui/stepper";
import {
  daysUntil,
  documentTitle,
  formatDate,
  signatureStatusLabel,
} from "@/lib/format";
import { getMatter, getMatterSignatures } from "@/lib/queries";

const LIVE = ["SENT", "VIEWED", "STARTED"];

// The stored row says SENT until someone acts on it, but a request whose link
// has passed its expiry is finished, and the Admin needs to read it that way.

export async function SignaturesTab({ matterId }: { matterId: string }) {
  const [matter, signatures] = await Promise.all([
    getMatter(matterId),
    getMatterSignatures(matterId),
  ]);
  const archived = matter?.archivedAt !== null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-muted">
          One signer per document version. Links expire on their own and can be
          revoked at any time.
        </span>
        {archived ? null : (
          <Link
            href={`/matters/${matterId}/request-signature`}
            className={buttonClasses("primary")}
          >
            <Icon name="plus" />
            New signature request
          </Link>
        )}
      </div>

      {signatures.length === 0 ? (
        <Card>
          <EmptyState
            icon="pen"
            title="No signature requests yet"
            description="Send a document to the client and follow it from sent to signed."
            action={
              archived ? undefined : (
                <Link
                  href={`/matters/${matterId}/request-signature`}
                  className={buttonClasses("primary", "sm")}
                >
                  New signature request
                </Link>
              )
            }
          />
        </Card>
      ) : (
        signatures.map((signature) => {
          const status = signature.effectiveStatus;
          const live = LIVE.includes(status);
          const daysLeft = daysUntil(signature.expiresAt);

          return (
            <Card key={signature.id} as="article" className="gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2 font-sans text-[15.5px] font-semibold">
                    {documentTitle(signature.documentVersion.document.name)}
                    <VersionTag>
                      v{signature.documentVersion.versionNo}
                    </VersionTag>
                  </h3>
                  <p className="text-muted">
                    Signer: {signature.signerName} ·{" "}
                    <span className="font-mono text-[13px]">
                      {signature.signerEmail}
                    </span>
                  </p>
                </div>
                <Badge tone={signatureStatusTone[status]}>
                  {signatureStatusLabel[status]}
                </Badge>
              </div>

              <SignatureStepper
                status={status}
                sentAt={signature.sentAt}
                viewedAt={signature.viewedAt}
                startedAt={signature.startedAt}
                signedAt={signature.signedAt}
                revokedAt={signature.revokedAt}
                expiresAt={signature.expiresAt}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <span className="text-muted">
                  {status === "SIGNED" ? (
                    "Signed PDF and certificate saved to the Signed folder"
                  ) : status === "REVOKED" ? (
                    `Link revoked · ${signature.revokedReason ?? "No reason given"}`
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="clock" className="size-3.5" />
                      Link expires {formatDate(signature.expiresAt)}
                      {daysLeft >= 0
                        ? ` (${daysLeft === 0 ? "today" : `in ${daysLeft} days`})`
                        : null}
                    </span>
                  )}
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  {status === "SIGNED" && signature.signedDocument ? (
                    <>
                      <Link
                        href={`/matters/${matterId}?tab=documents`}
                        className={buttonClasses("default", "sm")}
                      >
                        <Icon name="eye" className="size-4" />
                        View signed PDF
                      </Link>
                    </>
                  ) : null}

                  {live && !archived ? (
                    <>
                      <form action={resendSigningLink.bind(null, signature.id)}>
                        <Button type="submit" size="sm">
                          <Icon name="remind" className="size-4" />
                          Resend link
                        </Button>
                      </form>

                      <details>
                        <summary className={buttonClasses("default", "sm")}>
                          <Icon name="ban" className="size-4" />
                          Revoke
                        </summary>
                        <ValidatedForm
                          action={revokeSignature.bind(null, signature.id)}
                          className="mt-2 flex w-[min(360px,80vw)] flex-col gap-2 rounded-card border border-line bg-surface p-3 shadow-card"
                        >
                          <p className="text-[13px]">
                            {signature.signerName} will not be able to open or
                            sign this document again. You can send a new request
                            afterwards.
                          </p>
                          <Field label="Reason, kept in the activity log">
                            <Input
                              name="reason"
                              defaultValue="Document needs changes"
                              data-max={LIMITS.reason}
                            />
                          </Field>
                          <Button type="submit" variant="danger" size="sm">
                            Revoke link
                          </Button>
                        </ValidatedForm>
                      </details>
                    </>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })
      )}
    </>
  );
}
