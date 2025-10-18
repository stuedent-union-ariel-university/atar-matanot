/**
 * Script: remove users (items) from a Monday board representing the user list.
 * - Targets items whose user-id column starts with a given prefix (default: "user-")
 * - Safe by default (dry-run). Pass --yes to actually archive/delete.
 * - Archives by default; pass --delete to permanently delete.
 *
 * Examples:
 *   pnpm tsx scripts/remove-users-from-monday.ts                 # dry-run (show what would be removed)
 *   pnpm tsx scripts/remove-users-from-monday.ts --yes           # archive matching items
 *   pnpm tsx scripts/remove-users-from-monday.ts --yes --delete  # permanently delete matching items
 *   pnpm tsx scripts/remove-users-from-monday.ts --prefix seed-  # different prefix filter
 */

import "dotenv/config";
import { config } from "../src/lib/config";
import { mondayRequestWithRetry } from "../src/lib/monday";

type Args = Map<string, string>;

function requireEnv(name: keyof typeof config, friendly?: string) {
  const val = config[name];
  if (!val) throw new Error(`Missing env: ${friendly ?? name}`);
  return String(val);
}

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

type ItemsWithNamePage = {
  boards?: Array<{
    items_page?: {
      cursor: string | null;
      items: Array<{
        id: string;
        name?: string;
        column_values: Array<{ id: string; text: string }>;
      }>;
    };
  }>;
};

async function* iterateItems(
  boardId: string,
  columnId: string,
  pageSize = 500
): AsyncGenerator<
  { id: string; name?: string; userText?: string },
  void,
  void
> {
  let cursor: string | null = null;
  const query = `
    query Page($boardId: [ID!], $cursor: String, $limit: Int!, $columnId: [String!]) {
      boards(ids: $boardId) {
        items_page(limit: $limit, cursor: $cursor) {
          cursor
          items { id name column_values(ids: $columnId) { id text } }
        }
      }
    }
  `;
  for (let page = 0; page < 200; page++) {
    const data: ItemsWithNamePage =
      await mondayRequestWithRetry<ItemsWithNamePage>(query, {
        boardId,
        cursor,
        limit: pageSize,
        columnId: [columnId],
      });
    const items = data?.boards?.[0]?.items_page?.items ?? [];
    for (const item of items) {
      const userText: string | undefined = item?.column_values?.[0]?.text;
      yield { id: item.id, name: item.name, userText };
    }
    cursor = data?.boards?.[0]?.items_page?.cursor ?? null;
    if (!cursor) break;
  }
}

async function archiveItem(itemId: string) {
  const mutation = `mutation($itemId: ID!){ archive_item(item_id: $itemId){ id } }`;
  await mondayRequestWithRetry(mutation, { itemId });
}

async function deleteItem(itemId: string) {
  const mutation = `mutation($itemId: ID!){ delete_item(item_id: $itemId){ id } }`;
  await mondayRequestWithRetry(mutation, { itemId });
}

function toBool(v: string | undefined, def = false): boolean {
  if (v == null) return def;
  if (v === "true" || v === "1" || v === "yes" || v === "y") return true;
  if (v === "false" || v === "0" || v === "no" || v === "n") return false;
  return def;
}

async function main() {
  const boardId = requireEnv("USER_BOARD_ID", "MONDAY_USER_BOARD_ID");
  const userCol = requireEnv(
    "USER_BOARD_USER_ID_COLUMN_ID",
    "MONDAY_USER_BOARD_USER_ID_COLUMN_ID"
  );
  requireEnv("MONDAY_API_KEY");

  const args = parseArgs();
  const prefix = String(args.get("prefix") ?? "user-");
  const yes = toBool(args.get("yes"));
  const reallyDelete = toBool(args.get("delete"));
  const limit = Number(args.get("limit") ?? Infinity);
  const batchSize = Number(args.get("batch") ?? 20);
  const delayMs = Number(args.get("delayMs") ?? 100);
  const maxRetries = Number(args.get("retries") ?? 7);
  const minDelayMs = Number(args.get("minDelayMs") ?? 250);
  const maxDelayMs = Number(args.get("maxDelayMs") ?? 5000);
  const jitterMs = Number(args.get("jitterMs") ?? 250);

  console.log(
    `Scanning board ${boardId} for items with ${userCol} starting with "${prefix}"...`
  );

  const candidates: { id: string; name?: string; userText?: string }[] = [];
  for await (const item of iterateItems(boardId, userCol)) {
    if (typeof item.userText === "string" && item.userText.startsWith(prefix)) {
      candidates.push(item);
      if (candidates.length >= limit) break;
    }
  }

  if (candidates.length === 0) {
    console.log("No matching items found.");
    return;
  }

  console.log(
    `Found ${candidates.length} item(s). Example(s):\n` +
      candidates
        .slice(0, 10)
        .map((c) => ` - ${c.id}\t${c.name ?? "(no name)"}\t${c.userText ?? ""}`)
        .join("\n")
  );

  if (!yes) {
    console.log(
      "Dry-run: pass --yes to archive, or --yes --delete to permanently delete."
    );
    return;
  }

  console.log(
    reallyDelete
      ? "Deleting items (permanent)..."
      : "Archiving items (reversible)..."
  );

  let processed = 0;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const slice = candidates.slice(i, i + batchSize);
    const mutations = slice.map((it) =>
      mondayRequestWithRetry(
        reallyDelete
          ? `mutation($itemId: ID!){ delete_item(item_id: $itemId){ id } }`
          : `mutation($itemId: ID!){ archive_item(item_id: $itemId){ id } }`,
        { itemId: it.id },
        { retries: maxRetries, minDelayMs, maxDelayMs, jitterMs }
      )
    );
    const results = await Promise.allSettled(mutations);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.length - ok;
    processed += ok;
    if (fail > 0) {
      const firstErr = results.find((r) => r.status === "rejected") as
        | PromiseRejectedResult
        | undefined;
      if (firstErr) console.error("Some deletions failed:", firstErr.reason);
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    process.stdout.write(`\rProcessed: ${processed}/${candidates.length}`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Failed to remove users:", err);
  process.exitCode = 1;
});
