import Link from "next/link";

import {
  acceptDocumentRequest,
  requestChanges,
  resendUploadLink,
} from "@/app/actions/requests";
import { Icon } from "@/components/icons";
import { Badge, requestStatusTone } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Callout, Card, EmptyState } from "@/components/ui/card";
import { DueDate, VersionTag } from "@/components/ui/meta";
import { formatDate, requestStatusLabel } from "@/lib/format";
import { getMatter, getMatterRequests } from "@/lib/queries";

const ORDER = {
  SUBMITTED: 0,
  CHANGES_REQUESTED: 1,
  PENDING: 2,
  ACCEPTED: 3,
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
                          <form
                            action={requestChanges.bind(null, request.id)}
                            className="mt-2 flex w-[min(360px,80vw)] flex-col gap-2 rounded-card border border-line bg-surface p-3 shadow-card"
                          >
                            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                              What needs to change?
                              <textarea
                                name="note"
                                required
                                rows={3}
                                placeholder="e.g. The second page is missing."
                                className="rounded-lg border border-line bg-surface px-2.5 py-2 font-normal focus:border-accent focus:outline-none"
                              />
                            </label>
                            <p className="text-[12.5px] text-muted">
                              The client gets a new upload link by email. The
                              file they already sent is kept.
                            </p>
                            <Button type="submit" variant="primary" size="sm">
                              <Icon name="send" className="size-4" />
                              Send to client
                            </Button>
                          </form>
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
