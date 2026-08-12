/**
 * Script: Seed the User table (eligibility list) from an XLSX file.
 *
 * Input file format (first sheet), same as scripts/upload-users-from-xlsx.ts:
 *  - Column A: user id (required)
 *  - Column B: user name (optional but recommended)
 *  - Header row is skipped by default; pass --no-header if there is no header.
 *
 * Examples:
 *  pnpm tsx scripts/seed-users-to-db.ts --file ./users.xlsx --dry
 *  pnpm tsx scripts/seed-users-to-db.ts --file ./users.xlsx
 */
import "dotenv/config";
import { readFile, utils as XLSXUtils, WorkBook } from "xlsx";
import * as fs from "node:fs";
import * as path from "node:path";
import { prisma } from "../src/lib/prisma";

type Args = Map<string, string>;

function parseArgs(): Args {
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.replace(/^--/, "").split("=");
      if (v !== undefined) args.set(k, v);
      else if (
        i + 1 < process.argv.length &&
        !process.argv[i + 1].startsWith("--")
      )
        args.set(k, process.argv[++i]);
      else args.set(k, "true");
    }
  }
  return args;
}

function toBool(v: string | undefined, def = false): boolean {
  if (v == null) return def;
  if (["true", "1", "yes", "y"].includes(v)) return true;
  if (["false", "0", "no", "n"].includes(v)) return false;
  return def;
}

function validateFile(filePath: string) {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  if (!/\.(xlsx|xlsm|xls|xlsb)$/i.test(abs)) {
    console.warn("Warning: file does not look like an Excel workbook.");
  }
  return abs;
}

function* readUsersFromWorkbook(
  wb: WorkBook,
  skipHeader = true
): Generator<{ id: string; name?: string }> {
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return;
  const ws = wb.Sheets[firstSheetName];
  const rows: unknown[][] = XLSXUtils.sheet_to_json(ws, {
    header: 1,
    defval: "",
  }) as unknown[][];
  for (let i = 0; i < rows.length; i++) {
    if (skipHeader && i === 0) continue;
    const row = rows[i] as (string | number)[];
    const userId = String(row[0] ?? "").trim();
    const userName = String(row[1] ?? "").trim();
    if (!userId) continue; // require id
    yield { id: userId, name: userName || undefined };
  }
}

async function main() {
  const args = parseArgs();
  const file = args.get("file");
  if (!file) throw new Error("--file path/to/users.xlsx is required");
  const absFile = validateFile(file);

  const dry = toBool(args.get("dry"));
  const noHeader = toBool(args.get("no-header"));
  const limit = Number(args.get("limit") ?? Infinity);
  const batchSize = Number(args.get("batch") ?? 100);

  const workbook = readFile(absFile);
  // Read and deduplicate by user id (keep first occurrence)
  const seen = new Set<string>();
  const users: Array<{ id: string; name?: string }> = [];
  for (const u of readUsersFromWorkbook(workbook, !noHeader)) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    users.push(u);
  }

  const total = Math.min(
    users.length,
    Number.isFinite(limit) ? limit : users.length
  );
  if (total === 0) {
    console.log("No user rows found to process.");
    return;
  }

  console.log(`Preparing to upsert ${total} user(s) into the database`);
  if (dry) {
    console.log("Dry-run. First 10 rows:");
    for (const u of users.slice(0, Math.min(10, total))) {
      console.log(` - id: ${u.id}\tname: ${u.name ?? ""}`);
    }
    console.log("Pass without --dry to execute.");
    return;
  }

  let done = 0;
  for (let i = 0; i < total; i += batchSize) {
    const slice = users.slice(i, Math.min(i + batchSize, total));
    await Promise.all(
      slice.map((u) =>
        prisma.user.upsert({
          where: { id: u.id },
          create: { id: u.id, name: u.name },
          update: { name: u.name },
        })
      )
    );
    done += slice.length;
    process.stdout.write(`\rUpserted: ${done}/${total}`);
  }
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("Failed to seed users:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
