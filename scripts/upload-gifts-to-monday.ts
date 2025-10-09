/**
 * Script: Upload gifts (giftId and stock) from src/lib/gifts.ts to Monday Inventory board.
 * Behavior:
 *  - If an item with the giftId already exists (by INVENTORY_GIFT_ID_COLUMN_ID), update its stock.
 *  - Otherwise, create a new item and set both giftId and stock columns.
 *
 * Required env vars (see src/lib/config.ts):
 *  - MONDAY_API_KEY
 *  - MONDAY_INVENTORY_BOARD_ID
 *  - MONDAY_INVENTORY_GIFT_ID_COLUMN_ID  (Text column)
 *  - MONDAY_INVENTORY_STOCK_COLUMN_ID    (Numbers column)
 */

import "dotenv/config"; // Load environment variables from .env
import { config } from "../src/lib/config";
import { gifts } from "../src/lib/gifts";
import { mondayRequest } from "../src/lib/monday";
import type { ItemsPageQueryData, MondayItem } from "../src/types/monday";

// Reuse the same page query from src/lib/monday.ts
const ITEMS_PAGE_QUERY = `
  query Page($boardId: [ID!], $cursor: String, $limit: Int!, $columnId: [String!]) {
    boards(ids: $boardId) {
      items_page(limit: $limit, cursor: $cursor) {
        cursor
        items { id column_values(ids: $columnId) { id text } }
      }
    }
  }
`;

function requireEnv(name: keyof typeof config, friendly?: string) {
  const val = config[name];
  if (!val) {
    const key = friendly ?? name;
    throw new Error(`Missing environment variable: ${String(key)}`);
  }
  return String(val);
}

async function buildGiftIdToItemIdMap(): Promise<Map<string, string>> {
  const boardId = requireEnv("INVENTORY_BOARD_ID");
  const giftIdCol = requireEnv("INVENTORY_GIFT_ID_COLUMN_ID");
  const map = new Map<string, string>();
  let cursor: string | null = null;
  const limit = 500;
  for (let i = 0; i < 50; i++) {
    const data: ItemsPageQueryData = await mondayRequest(ITEMS_PAGE_QUERY, {
      boardId,
      cursor,
      limit,
      columnId: [giftIdCol],
    });
    const items: MondayItem[] = data?.boards?.[0]?.items_page?.items ?? [];
    for (const item of items) {
      const giftId = item.column_values?.find((c) => c.id === giftIdCol)?.text;
      if (giftId) map.set(giftId, item.id);
    }
    cursor = data?.boards?.[0]?.items_page?.cursor || null;
    if (!cursor) break;
  }
  return map;
}

async function createInventoryItem(
  giftId: string,
  stock: number,
  itemName?: string
) {
  const boardId = requireEnv("INVENTORY_BOARD_ID");
  const giftIdCol = requireEnv("INVENTORY_GIFT_ID_COLUMN_ID");
  const stockCol = requireEnv("INVENTORY_STOCK_COLUMN_ID");
  const mutation = `
    mutation($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) { id }
    }
  `;
  const columnValues = JSON.stringify({
    [giftIdCol]: giftId,
    [stockCol]: String(stock),
  });
  return mondayRequest(mutation, {
    boardId,
    itemName: itemName || giftId,
    columnValues,
  });
}

async function updateInventoryItemStock(itemId: string, nextStock: number) {
  const boardId = requireEnv("INVENTORY_BOARD_ID");
  const stockCol = requireEnv("INVENTORY_STOCK_COLUMN_ID");
  const mutation = `
    mutation($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) { id }
    }
  `;
  const columnValues = JSON.stringify({ [stockCol]: String(nextStock) });
  return mondayRequest(mutation, { boardId, itemId, columnValues });
}

async function main() {
  // Validate env
  requireEnv("MONDAY_API_KEY");
  const boardId = requireEnv("INVENTORY_BOARD_ID");
  requireEnv("INVENTORY_GIFT_ID_COLUMN_ID");
  requireEnv("INVENTORY_STOCK_COLUMN_ID");

  console.log("Uploading gifts to Monday Inventory board:", boardId);

  // Build a map of existing items by giftId once (to minimize API calls)
  const idMap = await buildGiftIdToItemIdMap();

  let created = 0;
  let updated = 0;
  for (const g of gifts) {
    const giftId = g.id;
    const stock = Number(g.stock ?? 0);
    if (!giftId) continue;

    const existingItemId = idMap.get(giftId);
    if (existingItemId) {
      await updateInventoryItemStock(existingItemId, stock);
      updated++;
      console.log(`Updated stock for ${giftId} -> ${stock}`);
    } else {
      await createInventoryItem(giftId, stock, g.title || giftId);
      created++;
      console.log(`Created item for ${giftId} with stock ${stock}`);
    }
  }

  console.log("");
  console.log(`Done. Created: ${created}, Updated: ${updated}`);
}

main().catch((err) => {
  console.error("Failed to upload gifts:", err);
  process.exitCode = 1;
});
