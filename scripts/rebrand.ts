import "dotenv/config";

import { prisma } from "../lib/prisma";

/**
 * Renames the demo firm and its Admin in an existing database, keeping every
 * matter, document and event that is already there.
 *
 *   npx tsx scripts/rebrand.ts
 *
 * `npm run db:reset` gets the same names by wiping and re-seeding; this is for
 * a database with work in it that should stay. Running it twice is harmless.
 */

const OLD = {
  firm: ["Harlow & Vance LLP", "Harlow & Vance"],
  admin: "Elena Vance",
  adminEmail: "elena.vance@harlowvance.example",
  prefix: "HV-",
};

const NEW = {
  firm: "Abdyli & Partners",
  firmEmail: "office@abdylipartners.example",
  admin: "Artiole Abdyli",
  adminEmail: "artiole.abdyli@abdylipartners.example",
  prefix: "AP-",
};

/** Replaces text inside a column with SQL, so long tables are one statement. */
async function replaceIn(table: string, column: string, from: string, to: string) {
  return prisma.$executeRawUnsafe(
    `UPDATE "${table}" SET "${column}" = REPLACE("${column}", $1, $2) WHERE "${column}" LIKE '%' || $1 || '%'`,
    from,
    to,
  );
}

async function main() {
  const counts: Record<string, number> = {};

  counts.firm = (
    await prisma.firm.updateMany({
      where: { name: { in: OLD.firm } },
      data: { name: NEW.firm, email: NEW.firmEmail },
    })
  ).count;

  counts.admin = (
    await prisma.user.updateMany({
      where: { OR: [{ name: OLD.admin }, { email: OLD.adminEmail }] },
      data: { name: NEW.admin, email: NEW.adminEmail },
    })
  ).count;

  // Matter references keep their number and only change the prefix.
  counts.references = await prisma.$executeRawUnsafe(
    `UPDATE "Matter" SET "reference" = $2 || SUBSTRING("reference" FROM LENGTH($1) + 1) WHERE "reference" LIKE $1 || '%'`,
    OLD.prefix,
    NEW.prefix,
  );

  // The Admin's name as it was recorded on history, notes and uploads.
  counts.activity =
    (await replaceIn("ActivityEvent", "actorName", OLD.admin, NEW.admin)) +
    (await replaceIn("ActivityEvent", "summary", OLD.admin, NEW.admin));
  counts.notes = await replaceIn("Note", "authorName", OLD.admin, NEW.admin);
  counts.uploads = await replaceIn("DocumentVersion", "uploadedByName", OLD.admin, NEW.admin);
  counts.signatures =
    (await replaceIn("SignatureRequest", "signerName", OLD.admin, NEW.admin)) +
    (await replaceIn("SignatureRequest", "signerEmail", OLD.adminEmail, NEW.adminEmail));

  // References and names quoted inside notification and email text.
  for (const [from, to] of [
    [OLD.firm[0], NEW.firm],
    [OLD.firm[1], NEW.firm],
    [OLD.admin, NEW.admin],
    [OLD.prefix, NEW.prefix],
  ]) {
    counts.notifications = (counts.notifications ?? 0) + (await replaceIn("Notification", "text", from, to));
    counts.emails =
      (counts.emails ?? 0) +
      (await replaceIn("EmailMessage", "subject", from, to)) +
      (await replaceIn("EmailMessage", "body", from, to));
  }

  // The Admin's existing session carries the old name nowhere, but a fresh
  // sign-in uses the new email, so ending sessions avoids any confusion.
  counts.sessions = (await prisma.session.deleteMany()).count;

  console.log("\nRenamed to", NEW.firm, "·", NEW.admin);
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key.padEnd(14)} ${value}`);
  }
  console.log(`\nSign in again as ${NEW.adminEmail} (password unchanged).\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
