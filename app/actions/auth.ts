"use server";

import { redirect } from "next/navigation";

import { verifyPassword } from "@/lib/password";
import { isEmail, type FieldErrors } from "@/lib/validation";
import { isRateLimited, rateLimit, waitMessage } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/session";

export type LoginState = { error?: string; fields?: FieldErrors } | null;

export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const fields: FieldErrors = {};
  if (!email) fields.email = "Enter your email address.";
  else if (!isEmail(email)) fields.email = "Enter a valid email address, like name@example.com.";
  if (!password) fields.password = "Enter your password.";
  if (Object.keys(fields).length) return { fields };

  // Ten wrong guesses in fifteen minutes, counted per account rather than per
  // address: served without a proxy in front, the address comes from a header
  // the caller sets, so an attacker would simply vary it. Only wrong guesses
  // are counted, because signing in correctly should not spend the budget.
  const key = `login:${email}`;
  const gate = isRateLimited(key, 10);
  if (!gate.ok) {
    return {
      error: `Too many sign-in attempts. ${waitMessage(gate.retryAfter)}`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // The same message either way: a wrong email and a wrong password must not be
  // distinguishable, or this becomes a way to discover who holds an account.
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    rateLimit(key, 10, 15 * 60_000);
    return { error: "That email address and password do not match." };
  }

  await createSession(user.id);
  redirect("/");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
