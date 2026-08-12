/**
 * Script: Seed the Gift table from the static catalog in src/lib/gifts.ts.
 *
 * Upserts by id, so it's safe to re-run after editing the catalog.
 * Stock is intentionally NOT copied — stock stays Monday-truth, read live at request time.
 *
 * Usage:
 *  pnpm db:seed:gifts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { gifts } from "../src/lib/gifts";

async function main() {
  let count = 0;
  for (const gift of gifts) {
    await prisma.gift.upsert({
      where: { id: gift.id },
      create: {
        id: gift.id,
        title: gift.title,
        description: gift.description,
        image: gift.image,
      },
      update: {
        title: gift.title,
        description: gift.description,
        image: gift.image,
      },
    });
    count++;
  }
  console.log(`Seeded ${count} gift(s) into the database.`);
}

main()
  .catch((err) => {
    console.error("Failed to seed gifts:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
