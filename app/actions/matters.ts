"use server";

import {
  ArchivedMatterError,
  assertMatterWritable,
  requireAdminActor,
} from "@/lib/admin";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { MatterStatus, Priority } from "@/app/generated/prisma/client";
import { matterStatusLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getFirm } from "@/lib/queries";
import { LIMITS, createChecker, type FieldErrors } from "@/lib/validation";

/**
 * Mutations for a matter.
 *
 * Each one writes its ActivityEvent in the same transaction as the change, so
 * the history and the data cannot disagree.
 */

export type MatterFormState = { error?: string; fields?: FieldErrors } | null;

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH"];
const STATUSES: MatterStatus[] = ["ACTIVE", "ON_HOLD", "CLOSED"];

/** Values from a select are still only strings from the browser. */
function pick<T extends string>(value: FormDataEntryValue | null, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** The key date that mirrors the matter's deadline. */
const DEADLINE_LABEL = "Deadline";

/**
 * Matter references run AP-<year>-<sequence>. The sequence is derived from the
 * highest reference of the year; the unique constraint on (firmId, reference)
 * is what actually guarantees no two matters share one.
 */
async function nextReference(firmId: string) {
  const year = new Date().getFullYear();
  const prefix = `AP-${year}-`;
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
  const { actor } = await requireAdminActor();
  const check = createChecker(formData);

  const title = check.text("title", {
    required: "Give the matter a title.",
    max: LIMITS.title,
    label: "Matter title",
  });
  const practiceArea =
    check.text("practiceArea", { max: LIMITS.label, label: "Practice area" }) ||
    "Property";
  const deadline = check.date("deadline", {
    notPast: "A new matter's deadline can't be in the past.",
  });

  let clientId = String(formData.get("clientId") ?? "");
  const addingClient = clientId === "__new";
  let newClient: { name: string; email: string } | null = null;

  if (addingClient) {
    newClient = {
      name: check.text("newClientName", {
        required: "Enter the new client's name.",
        max: LIMITS.name,
        label: "Client name",
      }),
      email: check.email("newClientEmail", {
        required: "Enter the new client's email address. Secure links are sent here.",
      }),
    };
  } else if (!clientId) {
    check.fail("clientId", "Choose a client for this matter.");
  } else if (!(await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }))) {
    check.fail("clientId", "That client no longer exists. Choose another one.");
  }

  if (!check.ok) return { fields: check.errors };

  const firm = await getFirm();

  // The Admin can add a client without leaving the form.
  if (addingClient && newClient) {
    const created = await prisma.client.create({
      data: {
        firmId: firm.id,
        ...newClient,
        type:
          formData.get("newClientType") === "COMPANY" ? "COMPANY" : "INDIVIDUAL",
      },
    });
    clientId = created.id;
  }

  const matter = await prisma.matter.create({
    data: {
      firmId: firm.id,
      clientId,
      reference: await nextReference(firm.id),
      title,
      practiceArea,
      priority: pick(formData.get("priority"), PRIORITIES, "MEDIUM"),
      deadline,
      keyDates: deadline
        ? { create: [{ label: DEADLINE_LABEL, date: deadline }] }
        : undefined,
      activity: {
        create: {
          type: "MATTER",
          summary: "Matter opened",
          ...actor,
        },
      },
    },
  });

  revalidatePath("/matters");
  redirect(`/matters/${matter.id}`);
}

export async function setMatterStatus(matterId: string, status: MatterStatus) {
  const { actor } = await requireAdminActor();
  if (!STATUSES.includes(status)) throw new Error("Unknown matter status");
  await assertMatterWritable(matterId);
  await prisma.$transaction([
    prisma.matter.update({ where: { id: matterId }, data: { status } }),
    prisma.activityEvent.create({
      data: {
        matterId,
        type: "MATTER",
        summary: `Status changed to ${matterStatusLabel[status]}`,
        ...actor,
      },
    }),
  ]);
  revalidatePath(`/matters/${matterId}`);
}

export async function archiveMatter(matterId: string) {
  const { actor } = await requireAdminActor();
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
        ...actor,
      },
    }),
  ]);
  revalidatePath(`/matters/${matterId}`);
  revalidatePath("/matters");
}

export async function restoreMatter(matterId: string) {
  const { actor } = await requireAdminActor();
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
        ...actor,
      },
    }),
  ]);
  revalidatePath(`/matters/${matterId}`);
  revalidatePath("/matters");
}

export async function toggleTask(taskId: string, done: boolean) {
  const { actor } = await requireAdminActor();

  const existing = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { matterId: true },
  });
  await assertMatterWritable(existing.matterId);

  await prisma.$transaction(async (tx) => {
    const task = await tx.task.update({
      where: { id: taskId },
      data: { completedAt: done ? new Date() : null },
    });
    await tx.activityEvent.create({
      data: {
        matterId: task.matterId,
        type: "TASK",
        summary: `${done ? "Completed" : "Reopened"} task: ${task.title}`,
        ...actor,
      },
    });
  });

  revalidatePath(`/matters/${existing.matterId}`);
}

export async function addTask(matterId: string, formData: FormData) {
  const { actor } = await requireAdminActor();
  await assertMatterWritable(matterId);
  // The form checks these as the Admin types; this is the server's copy of
  // the same rules, for a post that did not come through the form.
  const check = createChecker(formData);
  const title = check.text("title", { required: "-", max: LIMITS.title, label: "Task" });
  const dueDate = check.date("dueDate");
  if (!check.ok) return;

  await prisma.$transaction([
    prisma.task.create({ data: { matterId, title, dueDate } }),
    prisma.activityEvent.create({
      data: {
        matterId,
        type: "TASK",
        summary: `Task added: ${title}`,
        ...actor,
      },
    }),
  ]);
  revalidatePath(`/matters/${matterId}`);
}

export async function addNote(matterId: string, formData: FormData) {
  const { actor } = await requireAdminActor();
  await assertMatterWritable(matterId);
  const check = createChecker(formData);
  const body = check.text("body", { required: "-", max: LIMITS.note, label: "Note" });
  if (!check.ok) return;

  await prisma.$transaction([
    prisma.note.create({
      data: { matterId, body, authorName: actor.actorName },
    }),
    prisma.activityEvent.create({
      data: {
        matterId,
        type: "NOTE",
        summary: "Internal note added",
        ...actor,
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
  const { actor } = await requireAdminActor();
  try {
    await assertMatterWritable(matterId);
  } catch (error) {
    if (error instanceof ArchivedMatterError) return { error: error.message };
    throw error;
  }

  const check = createChecker(formData);
  const title = check.text("title", {
    required: "Give the matter a title.",
    max: LIMITS.title,
    label: "Matter title",
  });
  const practiceArea =
    check.text("practiceArea", { max: LIMITS.label, label: "Practice area" }) ||
    "Property";
  // An existing matter may already be past its deadline, so a past date is
  // allowed here; only an unreadable one is refused.
  const deadline = check.date("deadline");
  if (!check.ok) return { fields: check.errors };

  await prisma.$transaction(async (tx) => {
    await tx.matter.update({
      where: { id: matterId },
      data: {
        title,
        practiceArea,
        priority: pick(formData.get("priority"), PRIORITIES, "MEDIUM"),
        status: pick(formData.get("status"), STATUSES, "ACTIVE"),
        deadline,
      },
    });

    // The deadline is also listed among the key dates, under the label the
    // matter was opened with. Keep that entry in step, so the header and the
    // Key dates card never show two different deadlines.
    const existing = await tx.matterKeyDate.findFirst({
      where: { matterId, label: DEADLINE_LABEL },
      select: { id: true },
    });
    if (deadline && existing) {
      await tx.matterKeyDate.update({
        where: { id: existing.id },
        data: { date: deadline },
      });
    } else if (deadline) {
      await tx.matterKeyDate.create({
        data: { matterId, label: DEADLINE_LABEL, date: deadline },
      });
    } else if (existing) {
      await tx.matterKeyDate.delete({ where: { id: existing.id } });
    }

    await tx.activityEvent.create({
      data: {
        matterId,
        type: "MATTER",
        summary: "Matter details updated",
        ...actor,
      },
    });
  });

  revalidatePath(`/matters/${matterId}`);
  revalidatePath("/matters");
  redirect(`/matters/${matterId}`);
}

export async function addKeyDate(matterId: string, formData: FormData) {
  const { actor } = await requireAdminActor();
  await assertMatterWritable(matterId);

  const check = createChecker(formData);
  const label = check.text("label", { required: "-", max: LIMITS.label, label: "Key date" });
  const date = check.date("date", { required: "-" });
  if (!check.ok || !date) return;

  await prisma.$transaction([
    prisma.matterKeyDate.create({ data: { matterId, label, date } }),
    prisma.activityEvent.create({
      data: {
        matterId,
        type: "MATTER",
        summary: `Key date added: ${label}`,
        ...actor,
      },
    }),
  ]);

  revalidatePath(`/matters/${matterId}`);
}

export async function deleteKeyDate(keyDateId: string) {
  const { actor } = await requireAdminActor();

  const existing = await prisma.matterKeyDate.findUnique({
    where: { id: keyDateId },
    select: { matterId: true },
  });
  if (!existing) return;
  await assertMatterWritable(existing.matterId);

  const keyDate = await prisma.$transaction(async (tx) => {
    const removed = await tx.matterKeyDate.delete({
      where: { id: keyDateId },
    });
    await tx.activityEvent.create({
      data: {
        matterId: removed.matterId,
        type: "MATTER",
        summary: `Key date removed: ${removed.label}`,
        ...actor,
      },
    });
    return removed;
  });

  revalidatePath(`/matters/${keyDate.matterId}`);
}

async function taskMatter(taskId: string) {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { matterId: true, title: true },
  });
  await assertMatterWritable(task.matterId);
  return task;
}

async function noteMatter(noteId: string) {
  const note = await prisma.note.findUniqueOrThrow({
    where: { id: noteId },
    select: { matterId: true },
  });
  await assertMatterWritable(note.matterId);
  return note;
}

export async function updateTask(taskId: string, formData: FormData) {
  const { actor } = await requireAdminActor();
  const check = createChecker(formData);
  const title = check.text("title", { required: "-", max: LIMITS.title, label: "Task" });
  const dueDate = check.date("dueDate");
  if (!check.ok) return;

  const task = await taskMatter(taskId);

  await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data: { title, dueDate } }),
    prisma.activityEvent.create({
      data: {
        matterId: task.matterId,
        type: "TASK",
        summary:
          task.title === title ? `Task updated: ${title}` : `Task renamed: ${task.title} → ${title}`,
        ...actor,
      },
    }),
  ]);
  revalidatePath(`/matters/${task.matterId}`);
}

/**
 * Tasks are working items, not records, so they can be removed. The activity
 * log keeps a line saying it happened.
 */
export async function deleteTask(taskId: string) {
  const { actor } = await requireAdminActor();
  const task = await taskMatter(taskId);

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.task.deleteMany({ where: { id: taskId } });
    if (count !== 1) return;
    await tx.activityEvent.create({
      data: {
        matterId: task.matterId,
        type: "TASK",
        summary: `Task deleted: ${task.title}`,
        ...actor,
      },
    });
  });
  revalidatePath(`/matters/${task.matterId}`);
}

export async function updateNote(noteId: string, formData: FormData) {
  const { actor } = await requireAdminActor();
  const check = createChecker(formData);
  const body = check.text("body", { required: "-", max: LIMITS.note, label: "Note" });
  if (!check.ok) return;

  const note = await noteMatter(noteId);

  await prisma.$transaction([
    prisma.note.update({ where: { id: noteId }, data: { body } }),
    prisma.activityEvent.create({
      data: {
        matterId: note.matterId,
        type: "NOTE",
        summary: "Internal note edited",
        ...actor,
      },
    }),
  ]);
  revalidatePath(`/matters/${note.matterId}`);
}

export async function deleteNote(noteId: string) {
  const { actor } = await requireAdminActor();
  const note = await noteMatter(noteId);

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.note.deleteMany({ where: { id: noteId } });
    if (count !== 1) return;
    await tx.activityEvent.create({
      data: {
        matterId: note.matterId,
        type: "NOTE",
        summary: "Internal note deleted",
        ...actor,
      },
    });
  });
  revalidatePath(`/matters/${note.matterId}`);
}
