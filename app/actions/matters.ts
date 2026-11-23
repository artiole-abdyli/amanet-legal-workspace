"use server";

import { requireAdmin } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { MatterStatus, Priority } from "@/app/generated/prisma/client";
import { matterStatusLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getFirm } from "@/lib/queries";

/**
 * Mutations for a matter.
 *
 * Each one writes its ActivityEvent in the same transaction as the change, so
 * the history and the data cannot disagree.
 */

const ACTOR = { actorType: "ADMIN" as const, actorName: "Elena Vance" };

export type MatterFormState = { error: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Matter references run HV-<year>-<sequence>. The sequence is derived from the
 * highest reference of the year; the unique constraint on (firmId, reference)
 * is what actually guarantees no two matters share one.
 */
async function nextReference(firmId: string) {
  const year = new Date().getFullYear();
  const prefix = `HV-${year}-`;
  const last = await prisma.matter.findFirst({
    where: { firmId, reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const sequence = last ? Number(last.reference.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

export async function createMatter(
  _previous: MatterFormState,
  formData: FormData,
): Promise<MatterFormState> {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the matter a title." };

  const firm = await getFirm();
  let clientId = String(formData.get("clientId") ?? "");

  // The Admin can add a client without leaving the form.
  if (clientId === "__new") {
    const name = String(formData.get("newClientName") ?? "").trim();
    const email = String(formData.get("newClientEmail") ?? "").trim();
    if (!name) return { error: "Enter the new client's name." };
    if (!EMAIL.test(email)) {
      return { error: "Enter a valid email address for the new client." };
    }
    const created = await prisma.client.create({
      data: {
        firmId: firm.id,
        name,
        email,
        type:
          formData.get("newClientType") === "COMPANY" ? "COMPANY" : "INDIVIDUAL",
      },
    });
    clientId = created.id;
  }

  if (!clientId) return { error: "Choose a client for this matter." };

  const rawDeadline = String(formData.get("deadline") ?? "");
  const deadline = rawDeadline ? new Date(`${rawDeadline}T12:00:00`) : null;

  const matter = await prisma.matter.create({
    data: {
      firmId: firm.id,
      clientId,
      reference: await nextReference(firm.id),
      title,
      practiceArea: String(formData.get("practiceArea") ?? "Property"),
      priority: (formData.get("priority") as Priority) ?? "MEDIUM",
      deadline,
      keyDates: deadline
        ? { create: [{ label: "Deadline", date: deadline }] }
        : undefined,
      activity: {
        create: {
          type: "MATTER",
          summary: "Matter opened",
          ...ACTOR,
        },
      },
    },
  });

  revalidatePath("/matters");
  redirect(`/matters/${matter.id}`);
}

export async function setMatterStatus(matterId: string, status: MatterStatus) {
  await requireAdmin();
  await prisma.$transaction([
    prisma.matter.update({ where: { id: matterId }, data: { status } }),
    prisma.activityEvent.create({
      data: {
        matterId,
        type: "MATTER",
        summary: `Status changed to ${matterStatusLabel[status]}`,
        ...ACTOR,
      },
    }),
  ]);
  revalidatePath(`/matters/${matterId}`);
}

export async function archiveMatter(matterId: string) {
  await requireAdmin();
  await prisma.$transaction([
    prisma.matter.update({
      where: { id: matterId },
      data: { archivedAt: new Date() },
    }),
    prisma.activityEvent.create({
      data: {
        matterId,
        type: "MATTER",
        summary: "Matter archived",
        ...ACTOR,
      },
    }),
  ]);
  revalidatePath(`/matters/${matterId}`);
  revalidatePath("/matters");
}

export async function restoreMatter(matterId: string) {
  await requireAdmin();
  await prisma.$transaction([
    prisma.matter.update({
      where: { id: matterId },
      data: { archivedAt: null },
    }),
    prisma.activityEvent.create({
      data: {
        matterId,
        type: "MATTER",
        summary: "Matter restored from the archive",
        ...ACTOR,
      },
    }),
  ]);
  revalidatePath(`/matters/${matterId}`);
  revalidatePath("/matters");
}

export async function toggleTask(taskId: string, done: boolean) {
  await requireAdmin();
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { completedAt: done ? new Date() : null },
  });
  await prisma.activityEvent.create({
    data: {
      matterId: task.matterId,
      type: "TASK",
      summary: `${done ? "Completed" : "Reopened"} task: ${task.title}`,
      ...ACTOR,
    },
  });
  revalidatePath(`/matters/${task.matterId}`);
}

export async function addTask(matterId: string, formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const rawDue = String(formData.get("dueDate") ?? "");
  const dueDate = rawDue ? new Date(`${rawDue}T12:00:00`) : null;

  await prisma.$transaction([
    prisma.task.create({ data: { matterId, title, dueDate } }),
    prisma.activityEvent.create({
      data: {
        matterId,
        type: "TASK",
        summary: `Task added: ${title}`,
        ...ACTOR,
      },
    }),
  ]);
  revalidatePath(`/matters/${matterId}`);
}

export async function addNote(matterId: string, formData: FormData) {
  await requireAdmin();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await prisma.$transaction([
    prisma.note.create({
      data: { matterId, body, authorName: ACTOR.actorName },
    }),
    prisma.activityEvent.create({
      data: {
        matterId,
        type: "NOTE",
        summary: "Internal note added",
        ...ACTOR,
      },
    }),
  ]);
  revalidatePath(`/matters/${matterId}`);
}

/**
 * Editing a matter after it is open.
 *
 * Status has its own control in the matter header, but it belongs here too:
 * both call this layer, so the activity log reads the same either way.
 */
export async function updateMatter(
  matterId: string,
  _previous: MatterFormState,
  formData: FormData,
): Promise<MatterFormState> {
  await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the matter a title." };

  const rawDeadline = String(formData.get("deadline") ?? "");
  const deadline = rawDeadline ? new Date(`${rawDeadline}T12:00:00`) : null;

  await prisma.$transaction([
    prisma.matter.update({
      where: { id: matterId },
      data: {
        title,
        practiceArea: String(formData.get("practiceArea") ?? "Property"),
        priority: (formData.get("priority") as Priority) ?? "MEDIUM",
        status: (formData.get("status") as MatterStatus) ?? "ACTIVE",
        deadline,
      },
    }),
    prisma.activityEvent.create({
      data: {
        matterId,
        type: "MATTER",
        summary: "Matter details updated",
        ...ACTOR,
      },
    }),
  ]);

  revalidatePath(`/matters/${matterId}`);
  revalidatePath("/matters");
  redirect(`/matters/${matterId}`);
}

export async function addKeyDate(matterId: string, formData: FormData) {
  await requireAdmin();

  const label = String(formData.get("label") ?? "").trim();
  const raw = String(formData.get("date") ?? "");
  if (!label || !raw) return;

  const date = new Date(`${raw}T12:00:00`);

  await prisma.$transaction([
    prisma.matterKeyDate.create({ data: { matterId, label, date } }),
    prisma.activityEvent.create({
      data: {
        matterId,
        type: "MATTER",
        summary: `Key date added: ${label}`,
        ...ACTOR,
      },
    }),
  ]);

  revalidatePath(`/matters/${matterId}`);
}

export async function deleteKeyDate(keyDateId: string) {
  await requireAdmin();

  const keyDate = await prisma.matterKeyDate.delete({
    where: { id: keyDateId },
  });

  await prisma.activityEvent.create({
    data: {
      matterId: keyDate.matterId,
      type: "MATTER",
      summary: `Key date removed: ${keyDate.label}`,
      ...ACTOR,
    },
  });

  revalidatePath(`/matters/${keyDate.matterId}`);
}
