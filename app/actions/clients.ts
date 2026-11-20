"use server";

import { requireAdmin } from "@/lib/auth";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getFirm } from "@/lib/queries";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ClientFormState = { error: string } | null;

function read(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    type: formData.get("type") === "COMPANY" ? ("COMPANY" as const) : ("INDIVIDUAL" as const),
    contactName: String(formData.get("contactName") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim() || null,
  };
}

function validate(input: ReturnType<typeof read>): string | null {
  if (!input.name) return "Enter the client's name.";
  if (!EMAIL.test(input.email)) {
    return "Enter a valid email address, like name@example.com. Every secure link is sent here.";
  }
  return null;
}

export async function createClient(
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireAdmin();
  const input = read(formData);
  const error = validate(input);
  if (error) return { error };

  const firm = await getFirm();
  await prisma.client.create({ data: { firmId: firm.id, ...input } });

  revalidatePath("/clients");
  redirect("/clients");
}

export async function updateClient(
  clientId: string,
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireAdmin();
  const input = read(formData);
  const error = validate(input);
  if (error) return { error };

  await prisma.client.update({ where: { id: clientId }, data: input });

  revalidatePath("/clients");
  redirect("/clients");
}
