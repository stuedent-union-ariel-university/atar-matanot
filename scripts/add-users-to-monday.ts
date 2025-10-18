/**
 * Script: add a large number of users (items) to a Monday board representing the user list.
 * - Reads board/column IDs from env via src/lib/config
 * - Uses batching and small delay to be gentle with rate limits
 * - Generates deterministic mock users unless CSV provided later
 *
 * Run:
 *   pnpm tsx scripts/add-users-to-monday.ts --count 10000
 */

import "dotenv/config";
import { config } from "../src/lib/config";
import { mondayRequestWithRetry } from "../src/lib/monday";

function requireEnv(name: keyof typeof config, friendly?: string) {
  const val = config[name];
  if (!val) throw new Error(`Missing env: ${friendly ?? name}`);
  return String(val);
}

function parseArgs() {
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

async function createUserItem(
  boardId: string,
  userColumnId: string,
  userId: string
) {
  const mutation = `
    mutation($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) { id }
    }
  `;
  const columnValues = JSON.stringify({ [userColumnId]: userId });
  return mondayRequestWithRetry(mutation, {
    boardId,
    itemName: userId,
    columnValues,
  });
}

async function main() {
  const boardId = requireEnv("USER_BOARD_ID", "MONDAY_USER_BOARD_ID");
  const userCol = requireEnv(
    "USER_BOARD_USER_ID_COLUMN_ID",
    "MONDAY_USER_BOARD_USER_ID_COLUMN_ID"
  );
  requireEnv("MONDAY_API_KEY");

  const args = parseArgs();
  const count = Number(args.get("count") ?? 10000);
  const start = Number(args.get("start") ?? 1);
  const prefix = String(args.get("prefix") ?? "user");
  const delayMs = Number(args.get("delayMs") ?? 100);
  const batchSize = Number(args.get("batch") ?? 10); // lower default to be gentle
  const maxRetries = Number(args.get("retries") ?? 7);
  const minDelayMs = Number(args.get("minDelayMs") ?? 250);
  const maxDelayMs = Number(args.get("maxDelayMs") ?? 5000);
  const jitterMs = Number(args.get("jitterMs") ?? 250);

  console.log(`Adding ${count} users to board ${boardId}, column ${userCol}`);

  let created = 0;
  for (let i = start; i < start + count; i += batchSize) {
    const batch: Promise<unknown>[] = [];
    for (let j = i; j < Math.min(i + batchSize, start + count); j++) {
      const uid = `${prefix}-${j.toString().padStart(5, "0")}`;
      batch.push(
        // wrap with per-call options for retries and backoff
        mondayRequestWithRetry(
          `mutation($boardId: ID!, $itemName: String!, $columnValues: JSON!) { create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) { id } }`,
          {
            boardId,
            itemName: uid,
            columnValues: JSON.stringify({ [userCol]: uid }),
          },
          { retries: maxRetries, minDelayMs, maxDelayMs, jitterMs }
        )
      );
    }
    const results = await Promise.allSettled(batch);
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;
    created += succeeded;
    if (failed > 0) {
      const firstErr = results.find((r) => r.status === "rejected") as
        | PromiseRejectedResult
        | undefined;
      if (firstErr) console.error("Some items failed:", firstErr.reason);
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    process.stdout.write(`\rCreated: ${created}/${count}`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Failed to add users:", err);
  process.exitCode = 1;
});
