import { connection } from "next/server";

import { requireAdmin } from "@/lib/auth";

import type { SignatureStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Read models for the screens.
 *
 * Queries live here rather than inside components so a page states what it
 * needs once, and so the shapes the UI depends on are visible in one file.
 */

/** The states a request passes through while it is still out with the signer. */
const LIVE_SIGNATURE: SignatureStatus[] = ["SENT", "VIEWED", "STARTED"];

/**
 * Still actionable: not finished, not stopped, and not past its expiry.
 *
 * Expiry is a moment, not an event, so nothing writes EXPIRED into the row;
 * `lib/link-access` already refuses the link the second it passes. Counting it
 * here keeps the workspace from telling the Admin a dead request is live.
 */
function liveSignatureWhere() {
  return {
    status: { in: LIVE_SIGNATURE },
    expiresAt: { gt: new Date() },
  };
}

/** What the Admin should see, given the stored status and the clock. */
export function effectiveSignatureStatus(signature: {
  status: SignatureStatus;
  expiresAt: Date;
}): SignatureStatus {
  const live = LIVE_SIGNATURE.includes(signature.status);
  return live && signature.expiresAt.getTime() <= Date.now()
    ? "EXPIRED"
    : signature.status;
}

export async function getFirm() {
  await connection();
  return prisma.firm.findFirstOrThrow();
}

/**
 * A compact index for the Ctrl-K search. A firm's workspace holds hundreds of
 * rows, not millions, so sending one list beats a request per keystroke.
 */
export async function getSearchIndex() {
  await requireAdmin();
  const [matters, clients, documents] = await Promise.all([
    prisma.matter.findMany({
      orderBy: { openedAt: "desc" },
      select: { id: true, title: true, reference: true },
    }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
    prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        matter: { select: { id: true, reference: true } },
      },
    }),
  ]);

  return [
    ...matters.map((matter) => ({
      id: `matter-${matter.id}`,
      group: "Matters" as const,
      label: matter.title,
      hint: matter.reference,
      href: `/matters/${matter.id}`,
      icon: "folder" as const,
    })),
    ...clients.map((client) => ({
      id: `client-${client.id}`,
      group: "Clients" as const,
      label: client.name,
      hint: client.type === "COMPANY" ? "Company" : "Individual",
      href: "/clients",
      icon: "users" as const,
    })),
    ...documents.map((document) => ({
      id: `document-${document.id}`,
      group: "Documents" as const,
      label: document.name,
      hint: document.matter.reference,
      href: `/matters/${document.matter.id}?tab=documents`,
      icon: "file" as const,
    })),
  ];
}

export async function getNotifications() {
  await requireAdmin();
  return prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });
}

export async function getUnreadNotificationCount() {
  await requireAdmin();
  return prisma.notification.count({ where: { readAt: null } });
}

// --- Dashboard --------------------------------------------------------------

export type AttentionFocus = "review" | "signing" | "overdue";

/** How many rows each attention list shows before "Show all". */
export const ATTENTION_PREVIEW = 5;
/** How many key dates the side panel lists before pointing at the rest. */
export const KEY_DATES_PREVIEW = 6;

/**
 * Everything the dashboard shows, sized for a busy firm.
 *
 * Each list is counted in full but only a handful of rows are fetched, so the
 * page stays the same size whether ten things need attention or three hundred.
 * The one list the Admin has asked to expand comes back whole.
 */
export async function getDashboard(
  options: { expand?: AttentionFocus } = {},
) {
  await requireAdmin();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);
  const now = new Date();

  const take = (focus: AttentionFocus) =>
    options.expand === focus ? undefined : ATTENTION_PREVIEW;

  const signingWhere = {
    status: { in: ["VIEWED" as const, "STARTED" as const] },
    expiresAt: { gt: now },
  };
  const overdueWhere = {
    completedAt: null,
    dueDate: { lt: now },
    matter: { archivedAt: null },
  };
  const keyDateWhere = {
    date: { gte: now, lte: horizon },
    matter: { archivedAt: null, status: { not: "CLOSED" as const } },
  };

  const [
    openMatters,
    awaitingSignature,
    uploadsToReview,
    signingCount,
    overdueCount,
    keyDateCount,
    keyDates,
    submittedRequests,
    liveSignatures,
    overdueTasks,
    recentActivity,
  ] = await Promise.all([
    prisma.matter.count({
      where: { archivedAt: null, status: { not: "CLOSED" } },
    }),
    prisma.signatureRequest.count({ where: liveSignatureWhere() }),
    prisma.documentRequest.count({ where: { status: "SUBMITTED" } }),
    prisma.signatureRequest.count({ where: signingWhere }),
    prisma.task.count({ where: overdueWhere }),
    prisma.matterKeyDate.count({ where: keyDateWhere }),
    prisma.matterKeyDate.findMany({
      where: keyDateWhere,
      orderBy: { date: "asc" },
      take: KEY_DATES_PREVIEW,
      include: { matter: { select: { id: true, title: true, reference: true } } },
    }),
    prisma.documentRequest.findMany({
      where: { status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      take: take("review"),
      include: {
        matter: {
          select: {
            id: true,
            reference: true,
            client: { select: { name: true } },
          },
        },
      },
    }),
    prisma.signatureRequest.findMany({
      where: signingWhere,
      orderBy: { expiresAt: "asc" },
      take: take("signing"),
      include: {
        matter: { select: { id: true, reference: true } },
        documentVersion: {
          select: { document: { select: { name: true } } },
        },
      },
    }),
    prisma.task.findMany({
      where: overdueWhere,
      orderBy: { dueDate: "asc" },
      take: take("overdue"),
      include: { matter: { select: { id: true, reference: true } } },
    }),
    prisma.activityEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { matter: { select: { id: true, reference: true } } },
    }),
  ]);

  return {
    counts: {
      openMatters,
      awaitingSignature,
      uploadsToReview,
      keyDates: keyDateCount,
      review: uploadsToReview,
      signing: signingCount,
      overdue: overdueCount,
    },
    keyDates,
    submittedRequests,
    liveSignatures,
    overdueTasks,
    recentActivity,
  };
}

// --- Matters ----------------------------------------------------------------

export type MatterFilters = {
  query?: string;
  status?: "ACTIVE" | "ON_HOLD" | "CLOSED";
  priority?: "LOW" | "MEDIUM" | "HIGH";
  includeArchived?: boolean;
  sort?: "deadline" | "priority" | "opened";
  page?: number;
};

export const MATTERS_PER_PAGE = 5;

/**
 * One page of matters, with the total for the same filters.
 *
 * The count comes first so the requested page can be clamped: asking for page 7
 * of a three-page result returns the last page rather than an empty table that
 * looks like "nothing matched".
 */
export async function getMatters(filters: MatterFilters = {}) {
  await requireAdmin();
  const {
    query,
    status,
    priority,
    includeArchived,
    sort = "deadline",
    page = 1,
  } = filters;

  const where = {
    ...(includeArchived ? {} : { archivedAt: null }),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { reference: { contains: query, mode: "insensitive" as const } },
            {
              practiceArea: { contains: query, mode: "insensitive" as const },
            },
            {
              client: {
                name: { contains: query, mode: "insensitive" as const },
              },
            },
            {
              documents: {
                some: {
                  name: { contains: query, mode: "insensitive" as const },
                },
              },
            },
          ],
        }
      : {}),
  };

  const total = await prisma.matter.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / MATTERS_PER_PAGE));
  const current = Math.min(pageCount, Math.max(1, Math.trunc(page) || 1));

  const matters = await prisma.matter.findMany({
      where,
      orderBy:
        sort === "priority"
          ? [{ priority: "desc" }, { deadline: "asc" }]
          : sort === "opened"
            ? { openedAt: "desc" }
            : [{ deadline: "asc" }, { openedAt: "desc" }],
      skip: (current - 1) * MATTERS_PER_PAGE,
      take: MATTERS_PER_PAGE,
      include: {
        client: { select: { id: true, name: true } },
        keyDates: { orderBy: { date: "asc" } },
        _count: {
          select: {
            tasks: { where: { completedAt: null } },
            documentRequests: { where: { status: "SUBMITTED" } },
            signatureRequests: { where: liveSignatureWhere() },
          },
        },
      },
  });

  return {
    matters,
    total,
    page: current,
    perPage: MATTERS_PER_PAGE,
    pageCount,
  };
}

export async function getMatter(id: string) {
  await requireAdmin();
  return prisma.matter.findUnique({
    where: { id },
    include: {
      client: true,
      keyDates: { orderBy: { date: "asc" } },
      _count: {
        select: {
          documents: true,
          documentRequests: true,
          signatureRequests: true,
          tasks: { where: { completedAt: null } },
        },
      },
    },
  });
}

export async function getMatterOverview(matterId: string) {
  await requireAdmin();
  const [requests, signatures, tasks, activity] = await Promise.all([
    prisma.documentRequest.groupBy({
      by: ["status"],
      where: { matterId },
      _count: true,
    }),
    prisma.signatureRequest.count({
      where: { matterId, ...liveSignatureWhere() },
    }),
    prisma.task.count({ where: { matterId, completedAt: null } }),
    prisma.activityEvent.findMany({
      where: { matterId },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  const byStatus = Object.fromEntries(
    requests.map((row) => [row.status, row._count]),
  );

  return {
    toReview: byStatus.SUBMITTED ?? 0,
    awaitingClient:
      (byStatus.PENDING ?? 0) + (byStatus.CHANGES_REQUESTED ?? 0),
    signaturesInProgress: signatures,
    openTasks: tasks,
    activity,
  };
}

export async function getMatterDocuments(matterId: string) {
  await requireAdmin();
  return prisma.document.findMany({
    where: { matterId },
    orderBy: [{ folder: "asc" }, { name: "asc" }],
    include: {
      versions: { orderBy: { versionNo: "asc" } },
      signedForRequest: { select: { id: true } },
    },
  });
}

export async function getMatterRequests(matterId: string) {
  await requireAdmin();
  return prisma.documentRequest.findMany({
    where: { matterId },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    include: {
      submittedDocument: {
        include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } },
      },
    },
  });
}

export async function getMatterSignatures(matterId: string) {
  await requireAdmin();
  const signatures = await prisma.signatureRequest.findMany({
    where: { matterId },
    orderBy: { sentAt: "desc" },
    include: {
      documentVersion: {
        select: {
          versionNo: true,
          document: { select: { id: true, name: true } },
        },
      },
      signedDocument: { select: { id: true, name: true } },
    },
  });

  return signatures.map((signature) => ({
    ...signature,
    effectiveStatus: effectiveSignatureStatus(signature),
  }));
}

export async function getMatterTasksAndNotes(matterId: string) {
  await requireAdmin();
  const [tasks, notes] = await Promise.all([
    prisma.task.findMany({
      where: { matterId },
      orderBy: [{ completedAt: "asc" }, { dueDate: "asc" }],
    }),
    prisma.note.findMany({
      where: { matterId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { tasks, notes };
}

export async function getMatterActivity(matterId: string) {
  await requireAdmin();
  return prisma.activityEvent.findMany({
    where: { matterId },
    orderBy: { createdAt: "desc" },
  });
}

// --- Clients ----------------------------------------------------------------

export type ClientFilters = {
  query?: string;
  type?: "INDIVIDUAL" | "COMPANY";
  page?: number;
};

export const CLIENTS_PER_PAGE = 5;

export async function getClients(filters: ClientFilters = {}) {
  await requireAdmin();
  const { query, type, page = 1 } = filters;

  const where = {
    ...(type ? { type } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
            {
              contactName: { contains: query, mode: "insensitive" as const },
            },
          ],
        }
      : {}),
  };

  const total = await prisma.client.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / CLIENTS_PER_PAGE));
  const current = Math.min(pageCount, Math.max(1, Math.trunc(page) || 1));

  const clients = await prisma.client.findMany({
    where,
    orderBy: { name: "asc" },
    skip: (current - 1) * CLIENTS_PER_PAGE,
    take: CLIENTS_PER_PAGE,
    include: {
      matters: {
        orderBy: { openedAt: "desc" },
        select: { id: true, reference: true, archivedAt: true },
      },
    },
  });

  return {
    clients,
    total,
    page: current,
    perPage: CLIENTS_PER_PAGE,
    pageCount,
  };
}

/** How many things each client still owes the firm, for the clients table. */
export async function getClientWaitingCounts() {
  await requireAdmin();
  const [requests, signatures] = await Promise.all([
    prisma.documentRequest.findMany({
      where: { status: { in: ["PENDING", "CHANGES_REQUESTED"] } },
      select: { matter: { select: { clientId: true } } },
    }),
    prisma.signatureRequest.findMany({
      where: liveSignatureWhere(),
      select: { matter: { select: { clientId: true } } },
    }),
  ]);

  const counts = new Map<string, number>();
  for (const row of [...requests, ...signatures]) {
    const id = row.matter.clientId;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export async function getClient(id: string) {
  await requireAdmin();
  return prisma.client.findUnique({ where: { id } });
}

/** Just enough of each client to fill the picker on the new-matter form. */
export async function getClientOptions() {
  await requireAdmin();
  return prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

// --- Email ------------------------------------------------------------------

export const EMAILS_PER_PAGE = 25;

/**
 * What a message was for. The outbox has no column for it, because every
 * message the workspace sends starts with one of these fixed subject lines, and
 * a `startsWith` on an indexed table is all the filter needs.
 */
export const EMAIL_KINDS = {
  sign: { label: "Signature request", prefixes: ["Please sign: "] },
  reminder: {
    label: "Reminder",
    prefixes: ["A reminder to sign: ", "A reminder about "],
  },
  upload: { label: "Document request", prefixes: ["We need a document: "] },
  correction: { label: "New copy needed", prefixes: ["A new copy is needed: "] },
  signed: { label: "Signed copy", prefixes: ["Your signed copy: "] },
} as const;

export type EmailKind = keyof typeof EMAIL_KINDS;

export function emailKind(subject: string): EmailKind | null {
  for (const [kind, { prefixes }] of Object.entries(EMAIL_KINDS)) {
    if (prefixes.some((prefix) => subject.startsWith(prefix))) {
      return kind as EmailKind;
    }
  }
  return null;
}

export type EmailFilters = {
  query?: string;
  status?: "SENT" | "QUEUED" | "FAILED";
  kind?: EmailKind;
  page?: number;
};

/**
 * One page of the outbox, filtered, newest first.
 *
 * Built for volume: a week of a busy firm is thousands of rows, so the list
 * carries only what a row shows, the body is loaded for the one message that
 * is open, and search covers the two things someone chasing a message knows —
 * who it went to and what it was about.
 */
export async function getEmails(filters: EmailFilters = {}) {
  await requireAdmin();
  const { query, status, kind, page = 1 } = filters;

  const where = {
    ...(status ? { status } : {}),
    AND: [
      query
        ? {
            OR: [
              { to: { contains: query, mode: "insensitive" as const } },
              { subject: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {},
      kind && EMAIL_KINDS[kind]
        ? {
            OR: EMAIL_KINDS[kind].prefixes.map((prefix) => ({
              subject: { startsWith: prefix },
            })),
          }
        : {},
    ],
  };

  const total = await prisma.emailMessage.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / EMAILS_PER_PAGE));
  const current = Math.min(pageCount, Math.max(1, Math.trunc(page) || 1));

  const emails = await prisma.emailMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * EMAILS_PER_PAGE,
    take: EMAILS_PER_PAGE,
    select: {
      id: true,
      to: true,
      subject: true,
      status: true,
      sentAt: true,
      createdAt: true,
    },
  });

  return {
    emails,
    total,
    page: current,
    perPage: EMAILS_PER_PAGE,
    pageCount,
  };
}

/** The full message, for the reading pane. */
export async function getEmail(id: string) {
  await requireAdmin();
  return prisma.emailMessage.findUnique({ where: { id } });
}

/** Totals for the strip above the list: the whole outbox, and the last week. */
export async function getEmailStats() {
  await requireAdmin();

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [byStatus, lastWeek] = await Promise.all([
    prisma.emailMessage.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.emailMessage.count({ where: { createdAt: { gte: weekAgo } } }),
  ]);

  const count = (status: string) =>
    byStatus.find((row) => row.status === status)?._count._all ?? 0;

  return {
    sent: count("SENT"),
    queued: count("QUEUED"),
    failed: count("FAILED"),
    lastWeek,
  };
}
