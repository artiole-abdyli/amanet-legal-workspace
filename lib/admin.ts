import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Who is acting, taken from the session rather than written into the code, so
 * the activity log names whoever actually signed in.
 */
export async function requireAdminActor() {
  const user = await requireAdmin();
  return {
    user,
    actor: { actorType: "ADMIN" as const, actorName: user.name },
  };
}

export class ArchivedMatterError extends Error {
  constructor() {
    super("This matter is archived and cannot be changed.");
    this.name = "ArchivedMatterError";
  }
}

/**
 * Archiving makes a matter read-only, and the buttons disappear with it. That
 * is the interface's half of the promise; this is the server's. A form left
 * open in another tab, or a direct POST, must not be able to write to a matter
 * the workspace shows as archived. Every Admin mutation on a matter's contents
 * calls this before it writes.
 */
export async function assertMatterWritable(matterId: string) {
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { archivedAt: true },
  });
  if (!matter) throw new Error("Matter not found");
  if (matter.archivedAt) throw new ArchivedMatterError();
}
