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

export async function getDashboard() {
  await requireAdmin();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);
  const now = new Date();

  const [
    openMatters,
    awaitingSignature,
    uploadsToReview,
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
    prisma.matterKeyDate.findMany({
      where: {
        date: { gte: now, lte: horizon },
        matter: { archivedAt: null, status: { not: "CLOSED" } },
      },
      orderBy: { date: "asc" },
      include: { matter: { select: { id: true, title: true, reference: true } } },
    }),
    prisma.documentRequest.findMany({
      where: { status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
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
      where: {
        status: { in: ["VIEWED", "STARTED"] },
        expiresAt: { gt: new Date() },
      },
      orderBy: { sentAt: "desc" },
      include: {
        matter: { select: { id: true, reference: true } },
        documentVersion: {
          select: { document: { select: { name: true } } },
        },
      },
    }),
    prisma.task.findMany({
      where: {
        completedAt: null,
        dueDate: { lt: now },
        matter: { archivedAt: null },
      },
      orderBy: { dueDate: "asc" },
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
      keyDates: keyDates.length,
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

export const EMAILS_PER_PAGE = 10;

/**
 * The outbox.
 *
 * Every message the workspace sends is a row here, so the whole email side of
 * the brief can be read back without an SMTP server. In production the same
 * rows are the delivery log.
 */
export async function getEmails(page = 1) {
  await requireAdmin();

  const total = await prisma.emailMessage.count();
  const pageCount = Math.max(1, Math.ceil(total / EMAILS_PER_PAGE));
  const current = Math.min(pageCount, Math.max(1, Math.trunc(page) || 1));

  const emails = await prisma.emailMessage.findMany({
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * EMAILS_PER_PAGE,
    take: EMAILS_PER_PAGE,
  });

  return {
    emails,
    total,
    page: current,
    perPage: EMAILS_PER_PAGE,
    pageCount,
  };
}
