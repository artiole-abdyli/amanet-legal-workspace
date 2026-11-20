import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/session";

/**
 * The gate every Admin-only read, mutation and route passes through.
 *
 * It is deliberately not cached. A session can be revoked by signing out, and a
 * cached "yes" would outlive that, so the cost of one indexed lookup per
 * request is the right trade.
 */
export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** For places that need to know whether someone is signed in, without forcing it. */
export async function getCurrentUser() {
  return getSessionUser();
}
