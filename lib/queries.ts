import { connection } from "next/server";

import type { SignatureStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Read models for the screens.
 *
 * Queries live here rather than inside components so a page states what it
 * needs once, and so the shapes the UI depends on are visible in one file.
 */

/** A request that is still out with the signer and can still be acted on. */
const LIVE_SIGNATURE: SignatureStatus[] = ["SENT", "VIEWED", "STARTED"];

export async function getFirm() {
  await connection();
  return prisma.firm.findFirstOrThrow();
}

/** The single Admin. Replaced by the signed-in user once auth is wired up. */
export async function getAdminUser() {
  await connection();
  return prisma.user.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
}

/**
 * A compact index for the Ctrl-K search. A firm's workspace holds hundreds of
 * rows, not millions, so sending one list beats a request per keystroke.
 */
export async function getSearchIndex() {
  await connection();
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
  await connection();
  return prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });
}

export async function getUnreadNotificationCount() {
  await connection();
  return prisma.notification.count({ where: { readAt: null } });
}

// --- Dashboard --------------------------------------------------------------

export async function getDashboard() {
  await connection();
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
    prisma.signatureRequest.count({ where: { status: { in: LIVE_SIGNATURE } } }),
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
      where: { status: { in: ["VIEWED", "STARTED"] } },
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
};

export async function getMatters(filters: MatterFilters = {}) {
  await connection();
  const { query, status, priority, includeArchived, sort = "deadline" } = filters;

  const matters = await prisma.matter.findMany({
    where: {
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" as const } },
              { reference: { contains: query, mode: "insensitive" as const } },
              { practiceArea: { contains: query, mode: "insensitive" as const } },
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
    },
    orderBy:
      sort === "priority"
        ? [{ priority: "desc" }, { deadline: "asc" }]
        : sort === "opened"
          ? { openedAt: "desc" }
          : [{ deadline: "asc" }, { openedAt: "desc" }],
    include: {
      client: { select: { id: true, name: true } },
      keyDates: { orderBy: { date: "asc" } },
      _count: {
        select: {
          tasks: { where: { completedAt: null } },
          documentRequests: { where: { status: "SUBMITTED" } },
          signatureRequests: { where: { status: { in: LIVE_SIGNATURE } } },
        },
      },
    },
  });

  return matters;
}

export async function getMatterCount() {
  await connection();
  return prisma.matter.count();
}

export async function getMatter(id: string) {
  await connection();
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
  await connection();
  const [requests, signatures, tasks, activity] = await Promise.all([
    prisma.documentRequest.groupBy({
      by: ["status"],
      where: { matterId },
      _count: true,
    }),
    prisma.signatureRequest.count({
      where: { matterId, status: { in: LIVE_SIGNATURE } },
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
  await connection();
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
  await connection();
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
  await connection();
  return prisma.signatureRequest.findMany({
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
}

export async function getMatterTasksAndNotes(matterId: string) {
  await connection();
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
  await connection();
  return prisma.activityEvent.findMany({
    where: { matterId },
    orderBy: { createdAt: "desc" },
  });
}

// --- Clients ----------------------------------------------------------------

export async function getClients(query?: string) {
  await connection();
  return prisma.client.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { contactName: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    include: {
      matters: {
        orderBy: { openedAt: "desc" },
        select: { id: true, reference: true, archivedAt: true },
      },
    },
  });
}

/** How many things each client still owes the firm, for the clients table. */
export async function getClientWaitingCounts() {
  await connection();
  const [requests, signatures] = await Promise.all([
    prisma.documentRequest.findMany({
      where: { status: { in: ["PENDING", "CHANGES_REQUESTED"] } },
      select: { matter: { select: { clientId: true } } },
    }),
    prisma.signatureRequest.findMany({
      where: { status: { in: LIVE_SIGNATURE } },
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
  await connection();
  return prisma.client.findUnique({ where: { id } });
}

/** Just enough of each client to fill the picker on the new-matter form. */
export async function getClientOptions() {
  await connection();
  return prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
