import Link from "next/link";

import {
  acceptDocumentRequest,
  cancelDocumentRequest,
  requestChanges,
  resendUploadLink,
} from "@/app/actions/requests";
import { Icon } from "@/components/icons";
import { Badge, requestStatusTone } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Callout, Card, EmptyState } from "@/components/ui/card";
import { DueDate, VersionTag } from "@/components/ui/meta";
import { Field, Input, Textarea, ValidatedForm } from "@/components/ui/form";
import { LIMITS } from "@/lib/validation";
import { formatDate, requestStatusLabel } from "@/lib/format";
import { getMatter, getMatterRequests } from "@/lib/queries";

const ORDER = {
  SUBMITTED: 0,
  CHANGES_REQUESTED: 1,
  PENDING: 2,
  ACCEPTED: 3,
  CANCELLED: 4,
} as const;

export async function RequestsTab({ matterId }: { matterId: string }) {
  const [matter, requests] = await Promise.all([
    getMatter(matterId),
    getMatterRequests(matterId),
  ]);
  const archived = matter?.archivedAt !== null;

  const sorted = [...requests].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status],
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-muted">
          Clients upload through a secure link. They never create an account.
        </span>
        {archived ? null : (
          <Link
            href={`/matters/${matterId}/request-documents`}
            className={buttonClasses("primary")}
          >
            <Icon name="plus" />
            New request
          </Link>
        )}
      </div>

      {sorted.length === 0 ? (
        <Card>
          <EmptyState
            icon="upload"
            title="No document requests yet"
            description="Ask the client for files, and they land straight in this matter."
            action={
              archived ? undefined : (
                <Link
                  href={`/matters/${matterId}/request-documents`}
                  className={buttonClasses("primary", "sm")}
                >
                  New request
                </Link>
              )
            }
          />
        </Card>
      ) : (
        sorted.map((request) => {
          const latest = request.submittedDocument?.versions[0];
          return (
            <Card key={request.id} as="article" className="gap-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-sans text-[15.5px] font-semibold">
                    {request.title}
                  </h3>
                  <p className="text-muted">{request.description}</p>
                </div>
                <Badge tone={requestStatusTone[request.status]}>
                  {requestStatusLabel[request.status]}
                </Badge>
              </div>

              {request.status === "CHANGES_REQUESTED" && request.reviewNote ? (
                <Callout tone="warn">
                  <b>You asked for changes:</b> {request.reviewNote}
                </Callout>
              ) : null}

              {request.status === "CANCELLED" ? (
                <Callout>
                  <b>Cancelled:</b>{" "}
                  {(request.cancelReason ?? "No longer needed").replace(/\.$/, "")}.
                  The upload link no longer works.
                </Callout>
              ) : null}

              {latest && request.submittedDocument ? (
                <div>
                  <a
                    href={`/api/documents/${latest.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-1.5 hover:border-line-strong"
                  >
                    <Icon name="file" className="size-4 shrink-0" />
                    <span className="truncate">
                      {request.submittedDocument.name}
                    </span>
                    <VersionTag>v{latest.versionNo}</VersionTag>
                  </a>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <span className="text-muted">
                  Requested {formatDate(request.requestedAt)}
                  {request.status === "ACCEPTED" ? (
                    " · Accepted"
                  ) : request.status === "CANCELLED" ? (
                    " · Cancelled"
                  ) : request.dueDate ? (
                    <>
                      {" · "}
                      <DueDate date={request.dueDate} prefix="Due" />
                    </>
                  ) : null}
                </span>

                {archived ? null : (
                  <div className="flex flex-wrap items-center gap-2">
                    {request.status === "SUBMITTED" ? (
                      <>
                        <details className="relative">
                          <summary className={buttonClasses("default", "sm")}>
                            Request changes
                          </summary>
                          <ValidatedForm
                            action={requestChanges.bind(null, request.id)}
                            className="mt-2 flex w-[min(360px,80vw)] flex-col gap-2 rounded-card border border-line bg-surface p-3 shadow-card"
                          >
                            <Field label="What needs to change?" required>
                              <Textarea
                                name="note"
                                required
                                rows={3}
                                data-max={LIMITS.description}
                                data-msg-required="Tell the client what to fix, so the next copy is right."
                                placeholder="e.g. The second page is missing."
                              />
                            </Field>
                            <p className="text-[12.5px] text-muted">
                              The client gets a new upload link by email. The
                              file they already sent is kept.
                            </p>
                            <Button type="submit" variant="primary" size="sm">
                              <Icon name="send" className="size-4" />
                              Send to client
                            </Button>
                          </ValidatedForm>
                        </details>

                        <form
                          action={acceptDocumentRequest.bind(null, request.id)}
                        >
                          <Button type="submit" variant="primary" size="sm">
                            <Icon name="check" className="size-4" />
                            Accept
                          </Button>
                        </form>
                      </>
                    ) : null}

                    {request.status === "PENDING" ||
                    request.status === "CHANGES_REQUESTED" ? (
                      <form action={resendUploadLink.bind(null, request.id)}>
                        <Button type="submit" size="sm">
                          <Icon name="remind" className="size-4" />
                          Resend link
                        </Button>
                      </form>
                    ) : null}

                    {request.status === "PENDING" ||
                    request.status === "CHANGES_REQUESTED" ||
                    request.status === "SUBMITTED" ? (
                      <details className="relative">
                        <summary className={buttonClasses("ghost", "sm")}>
                          <Icon name="ban" className="size-4" />
                          Cancel request
                        </summary>
                        <ValidatedForm
                          action={cancelDocumentRequest.bind(null, request.id)}
                          className="absolute right-0 z-10 mt-2 flex w-[min(360px,80vw)] flex-col gap-2 rounded-card border border-line bg-surface p-3 shadow-card"
                        >
                          <p className="text-[13px]">
                            The upload link stops working straight away. Any file
                            already sent stays in the matter.
                          </p>
                          <Field label="Reason, kept in the activity log">
                            <Input
                              name="reason"
                              defaultValue="No longer needed"
                              data-max={LIMITS.reason}
                            />
                          </Field>
                          <Button type="submit" variant="danger" size="sm">
                            Cancel request
                          </Button>
                        </ValidatedForm>
                      </details>
                    ) : null}
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}
    </>
  );
}
