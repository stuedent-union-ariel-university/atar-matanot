/**
 * Script: archive/delete claims items whose user id is not present in the user board.
 * - Builds a set of user ids from the user board
 * - Scans the claims board for user ids missing in that set
 * - Dry-run by default; pass --yes to execute
 * - Archives by default; pass --delete to permanently delete
 *
 * Examples:
 *   pnpm tsx scripts/clean-claims-not-in-users.ts
 *   pnpm tsx scripts/clean-claims-not-in-users.ts --yes
 *   pnpm tsx scripts/clean-claims-not-in-users.ts --yes --delete
 */

import "dotenv/config";
import { config } from "../src/lib/config";
import { mondayRequestWithRetry } from "../src/lib/monday";

type Args = Map<string, string>;

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

function toBool(v: string | undefined, def = false): boolean {
  if (v == null) return def;
  if (v === "true" || v === "1" || v === "yes" || v === "y") return true;
  if (v === "false" || v === "0" || v === "no" || v === "n") return false;
  return def;
}

async function* iterateItems(
  boardId: string,
  columnId: string,
  pageSize = 500,
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

async function main() {
  const claimsBoardId = requireEnv("CLAIMS_BOARD_ID", "MONDAY_CLAIMS_BOARD_ID");
  const claimsUserCol = requireEnv(
    "CLAIMS_BOARD_USER_ID_COLUMN_ID",
    "MONDAY_CLAIMS_BOARD_USER_ID_COLUMN_ID",
  );
  const userBoardId = requireEnv("USER_BOARD_ID", "MONDAY_USER_BOARD_ID");
  const userIdCol = requireEnv(
    "USER_BOARD_USER_ID_COLUMN_ID",
    "MONDAY_USER_BOARD_USER_ID_COLUMN_ID",
  );
  requireEnv("MONDAY_API_KEY");

  const args = parseArgs();
  const yes = toBool(args.get("yes"));
  const reallyDelete = toBool(args.get("delete"));
  const listKeep = toBool(args.get("list-keep"));
  const limit = Number(args.get("limit") ?? Infinity);
  const batchSize = Number(args.get("batch") ?? 20);
  const delayMs = Number(args.get("delayMs") ?? 100);
  const maxRetries = Number(args.get("retries") ?? 7);
  const minDelayMs = Number(args.get("minDelayMs") ?? 250);
  const maxDelayMs = Number(args.get("maxDelayMs") ?? 5000);
  const jitterMs = Number(args.get("jitterMs") ?? 250);

  console.log(
    `Building user id set from user board ${userBoardId}, column ${userIdCol}...`,
  );

  const userIds = new Set<string>();
  for await (const item of iterateItems(userBoardId, userIdCol)) {
    const raw = (item.userText ?? "").trim();
    if (raw) userIds.add(raw);
  }

  console.log(`User ids loaded: ${userIds.size}`);
  console.log(
    `Scanning claims board ${claimsBoardId}, column ${claimsUserCol} for missing users...`,
  );

  const candidates: { id: string; name?: string; userText?: string }[] = [];
  const missingUserIdItems: { id: string; name?: string }[] = [];
  const keepItems: { id: string; name?: string; userText?: string }[] = [];
  for await (const item of iterateItems(claimsBoardId, claimsUserCol)) {
    const userId = (item.userText ?? "").trim();
    if (!userId) {
      missingUserIdItems.push({ id: item.id, name: item.name });
      continue;
    }
    if (!userIds.has(userId)) {
      candidates.push(item);
      if (candidates.length >= limit) break;
    } else if (listKeep) {
      keepItems.push(item);
    }
  }

  if (missingUserIdItems.length > 0) {
    console.log(
      `Found ${missingUserIdItems.length} claim item(s) with empty user id (left untouched).`,
    );
  }

  if (listKeep) {
    if (keepItems.length === 0) {
      console.log("No claim items to keep were found.");
      return;
    }
    console.log(
      `Found ${keepItems.length} claim item(s) to keep. Example(s):\n` +
        keepItems
          .slice(0, 10)
          .map(
            (c) => ` - ${c.id}\t${c.name ?? "(no name)"}\t${c.userText ?? ""}`,
          )
          .join("\n"),
    );
    return;
  }

  if (candidates.length === 0) {
    console.log("No claims to clean.");
    return;
  }

  console.log(
    `Found ${candidates.length} claim item(s) whose user is missing from the user board. Example(s):\n` +
      candidates
        .slice(0, 10)
        .map((c) => ` - ${c.id}\t${c.name ?? "(no name)"}\t${c.userText ?? ""}`)
        .join("\n"),
  );

  if (!yes) {
    console.log(
      "Dry-run: pass --yes to archive, or --yes --delete to permanently delete.",
    );
    return;
  }

  console.log(
    reallyDelete
      ? "Deleting claim items (permanent)..."
      : "Archiving claim items (reversible)...",
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
        { retries: maxRetries, minDelayMs, maxDelayMs, jitterMs },
      ),
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
  console.error("Failed to clean claims:", err);
  process.exitCode = 1;
});
