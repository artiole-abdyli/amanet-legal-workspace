"use server";

import { requireAdmin } from "@/lib/auth";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

export async function markAllNotificationsRead() {
  await requireAdmin();
  await prisma.notification.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}

export async function markNotificationRead(id: string) {
  await requireAdmin();
  await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}
