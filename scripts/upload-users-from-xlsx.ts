/**
 * Script: Upload users from an XLSX file to a Monday board.
 *
 * Input file format (first sheet):
 *  - Column A: user id (required)
 *  - Column B: user name (optional but recommended)
 *  - Header row will be skipped by default; pass --no-header if there is no header.
 *
 * Env defaults (override via CLI flags):
 *  - MONDAY_API_KEY
 *  - MONDAY_USER_BOARD_ID                       (--board)
 *  - MONDAY_USER_BOARD_USER_ID_COLUMN_ID       (--user-id-col)
 *  - MONDAY_USER_BOARD_USER_NAME_COLUMN_ID     (--user-name-col)
 *
 * Examples:
 *  pnpm tsx scripts/upload-users-from-xlsx.ts --file ./users.xlsx
 *  pnpm tsx scripts/upload-users-from-xlsx.ts --file ./users.xlsx --board 12345 --user-id-col text --user-name-col text1
 *  pnpm tsx scripts/upload-users-from-xlsx.ts --file ./users.xlsx --dry  # preview only
 */

import "dotenv/config";
import { readFile, utils as XLSXUtils, WorkBook } from "xlsx";
import { config } from "../src/lib/config";
import { mondayRequestWithRetry } from "../src/lib/monday";
import * as fs from "node:fs";
import * as path from "node:path";

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

function requireEnv(name: keyof typeof config, friendly?: string) {
  const val = config[name];
  if (!val) throw new Error(`Missing env: ${friendly ?? name}`);
  return String(val);
}

async function createUserItem(
  boardId: string,
  userIdCol: string,
  userId: string,
  userNameCol?: string,
  userName?: string,
  groupId?: string
) {
  const mutation = `
    mutation($boardId: ID!, $itemName: String!, $columnValues: JSON!, $groupId: String) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues, group_id: $groupId) { id }
    }
  `;
  const values: Record<string, string> = { [userIdCol]: userId };
  if (userNameCol && userName != null && userName !== "") {
    values[userNameCol] = String(userName);
  }
  const columnValues = JSON.stringify(values);
  const itemName = userName?.trim() || userId;
  return mondayRequestWithRetry(mutation, {
    boardId,
    itemName,
    columnValues,
    groupId,
  });
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

  // Defaults from env but can be overridden via flags
  const boardId = String(args.get("board") ?? config.USER_BOARD_ID ?? "");
  const userIdCol = String(
    args.get("user-id-col") ?? config.USER_BOARD_USER_ID_COLUMN_ID ?? ""
  );
  const userNameCol = String(
    args.get("user-name-col") ?? config.USER_BOARD_USER_NAME_COLUMN_ID ?? ""
  );
  const groupId = args.get("group") ?? undefined;
  const dry = toBool(args.get("dry"));
  const noHeader = toBool(args.get("no-header"));
  const limit = Number(args.get("limit") ?? Infinity);
  const batchSize = Number(args.get("batch") ?? 10);
  const delayMs = Number(args.get("delayMs") ?? 100);
  const retries = Number(args.get("retries") ?? 7);
  const minDelayMs = Number(args.get("minDelayMs") ?? 250);
  const maxDelayMs = Number(args.get("maxDelayMs") ?? 5000);
  const jitterMs = Number(args.get("jitterMs") ?? 250);

  // Required envs
  requireEnv("MONDAY_API_KEY");
  if (!boardId)
    throw new Error(
      "Board id is required. Provide --board or MONDAY_USER_BOARD_ID."
    );
  if (!userIdCol)
    throw new Error(
      "User id column id is required. Provide --user-id-col or MONDAY_USER_BOARD_USER_ID_COLUMN_ID."
    );

  const workbook = readFile(absFile);
  // Read and deduplicate by user id (keep first occurrence)
  const seen = new Set<string>();
  const users = [] as Array<{ id: string; name?: string }>;
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

  console.log(`Preparing to upload ${total} user(s) to board ${boardId}`);
  console.log(
    `Using columns -> id: ${userIdCol}${
      userNameCol ? ", name: " + userNameCol : ""
    }${groupId ? ", group: " + groupId : ""}`
  );
  if (dry) {
    console.log("Dry-run. First 10 rows:");
    for (const u of users.slice(0, Math.min(10, total))) {
      console.log(` - id: ${u.id}\tname: ${u.name ?? ""}`);
    }
    console.log("Pass --dry=false or omit --dry to execute.");
    return;
  }

  let created = 0;
  for (let i = 0; i < total; i += batchSize) {
    const slice = users.slice(i, Math.min(i + batchSize, total));
    const batch = slice.map((u) =>
      mondayRequestWithRetry(
        `mutation($boardId: ID!, $itemName: String!, $columnValues: JSON!, $groupId: String) { create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues, group_id: $groupId) { id } }`,
        {
          boardId,
          itemName: u.name?.trim() || u.id,
          columnValues: JSON.stringify({
            [userIdCol]: u.id,
            ...(userNameCol ? { [userNameCol]: u.name ?? "" } : {}),
          }),
          groupId,
        },
        { retries, minDelayMs, maxDelayMs, jitterMs }
      )
    );
    const results = await Promise.allSettled(batch);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.length - ok;
    created += ok;
    if (fail > 0) {
      const firstErr = results.find((r) => r.status === "rejected") as
        | PromiseRejectedResult
        | undefined;
      if (firstErr) console.error("Some creations failed:", firstErr.reason);
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    process.stdout.write(`\rCreated: ${created}/${total}`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Failed to upload users from xlsx:", err);
  process.exitCode = 1;
});
