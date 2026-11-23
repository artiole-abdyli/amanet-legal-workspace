import Link from "next/link";

import { Icon } from "@/components/icons";
import { buttonClasses } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { VersionTag } from "@/components/ui/meta";
import { cn } from "@/lib/cn";
import { folderLabel, formatBytes, formatDate } from "@/lib/format";
import { getMatter, getMatterDocuments } from "@/lib/queries";

const FOLDERS = ["CONTRACTS", "CLIENT_UPLOADS", "SIGNED"] as const;

const FOLDER_ICON = {
  CONTRACTS: { icon: "file", tone: "bg-danger-bg text-danger" },
  CLIENT_UPLOADS: { icon: "file", tone: "bg-info-bg text-info" },
  SIGNED: { icon: "shield", tone: "bg-ok-bg text-ok" },
} as const;

export async function DocumentsTab({ matterId }: { matterId: string }) {
  const [matter, documents] = await Promise.all([
    getMatter(matterId),
    getMatterDocuments(matterId),
  ]);
  const archived = matter?.archivedAt !== null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-muted">
          {documents.length} file{documents.length === 1 ? "" : "s"}. Uploading a
          file with the same name adds a new version; nothing is overwritten.
        </span>
        {archived ? null : (
          <Link
            href={`/matters/${matterId}/upload`}
            className={buttonClasses("default")}
          >
            <Icon name="upload" />
            Upload PDF
          </Link>
        )}
      </div>

      {documents.length === 0 ? (
        <Card>
          <EmptyState
            icon="file"
            title="No documents yet"
            description="Upload a contract, or ask the client for the files you need."
          />
        </Card>
      ) : (
        <Card className="gap-6">
          {FOLDERS.map((folder) => {
            const inFolder = documents.filter((doc) => doc.folder === folder);
            return (
              <div key={folder} className="flex flex-col">
                <h3 className="flex items-center gap-2 pb-2 text-[13px] font-semibold text-muted">
                  <Icon name="folder" className="size-4" />
                  {folderLabel[folder]}
                  <span className="font-normal">({inFolder.length})</span>
                </h3>

                {inFolder.length === 0 ? (
                  <p className="border-t border-line py-2.5 text-muted">
                    No files here yet.
                  </p>
                ) : (
                  inFolder.map((document) => {
                    const latest = document.versions[document.versions.length - 1];
                    const style = FOLDER_ICON[folder];
                    return (
                      <div
                        key={document.id}
                        className="flex flex-wrap items-center gap-3 border-t border-line py-2.5"
                      >
                        <span
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-lg",
                            style.tone,
                          )}
                        >
                          <Icon name={style.icon} className="size-4" />
                        </span>

                        <span className="min-w-0 flex-1 basis-[240px]">
                          <a
                            href={`/api/documents/${latest.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium underline-offset-2 hover:text-accent hover:underline"
                          >
                            {document.name}
                          </a>
                          <small className="block text-[12.5px] text-muted">
                            {formatDate(latest.createdAt)} · {latest.uploadedByName}{" "}
                            · {formatBytes(latest.byteSize)}
                          </small>
                        </span>

                        <VersionTag>
                          v{latest.versionNo}
                          {document.versions.length > 1
                            ? ` of ${document.versions.length}`
                            : ""}
                        </VersionTag>

                        <span className="flex items-center gap-1">
                          {folder === "CONTRACTS" && !archived ? (
                            <Link
                              href={`/matters/${matterId}/request-signature?document=${document.id}`}
                              className={buttonClasses("default", "sm")}
                            >
                              <Icon name="send" className="size-4" />
                              Send for signature
                            </Link>
                          ) : null}
                          {folder !== "SIGNED" && !archived ? (
                            <Link
                              href={`/matters/${matterId}/sign/${document.id}`}
                              className={buttonClasses("default", "sm")}
                            >
                              <Icon name="pen" className="size-4" />
                              Sign
                            </Link>
                          ) : null}
                          <a
                            href={`/api/documents/${latest.id}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Preview ${document.name}`}
                            className={buttonClasses("ghost", "sm")}
                          >
                            <Icon name="eye" className="size-4" />
                          </a>
                          <a
                            href={`/api/documents/${latest.id}?download=1`}
                            aria-label={`Download ${document.name}`}
                            className={buttonClasses("ghost", "sm")}
                          >
                            <Icon name="download" className="size-4" />
                          </a>
                        </span>

                        {document.versions.length > 1 ? (
                          <details className="w-full">
                            <summary className="cursor-pointer text-[12.5px] text-muted hover:text-fg">
                              Earlier versions
                            </summary>
                            <ul className="mt-2 flex flex-col gap-1.5 border-l border-line pl-3">
                              {[...document.versions]
                                .slice(0, -1)
                                .reverse()
                                .map((version) => (
                                  <li
                                    key={version.id}
                                    className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted"
                                  >
                                    <VersionTag>v{version.versionNo}</VersionTag>
                                    <span>
                                      {formatDate(version.createdAt)} ·{" "}
                                      {version.uploadedByName}
                                    </span>
                                    <a
                                      href={`/api/documents/${version.id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-accent underline underline-offset-2"
                                    >
                                      Open
                                    </a>
                                  </li>
                                ))}
                            </ul>
                          </details>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
