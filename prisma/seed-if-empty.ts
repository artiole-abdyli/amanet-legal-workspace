import "dotenv/config";

import { prisma } from "../lib/prisma";

/**
 * Seeds the demo data only into an empty database.
 *
 * The full seed wipes every table first, which is right for `npm run db:reset`
 * and wrong for a deployment that restarts: a redeploy must not throw away
 * what a reviewer has just done in the demo.
 */
async function run() {
  const firms = await prisma.firm.count();

  if (firms > 0) {
    console.log("Demo data already present; not seeding.");
    await prisma.$disconnect();
    return;
  }

  console.log("Empty database: seeding the demo data…");
  // The seed runs on import and disconnects when it is done.
  await import("./seed");
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
