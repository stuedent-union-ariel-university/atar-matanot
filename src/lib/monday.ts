import { config } from "./config";
import type {
  MondayColumnValue,
  MondayItem,
  MondayGraphQLError,
  ItemsPageQueryData,
  CreateItemResponse,
} from "@/types/monday";
import { gifts as baseGifts, type Gift } from "@/lib/gifts";

// Generic GraphQL request helper with typed response & variables
export async function mondayRequest<
  TData,
  TVars extends Record<string, unknown> = Record<string, unknown>
>(query: string, variables?: TVars): Promise<TData> {
  const response = await fetch(config.MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.MONDAY_API_KEY || ""}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = (await response.json()) as {
    data: TData;
    errors?: MondayGraphQLError[];
  };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join(";"));
  }
  return json.data;
}

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

export async function findUserInBoard(
  boardId: string,
  columnId: string,
  userId: string,
  pageSize = 500,
  maxPages = 25
): Promise<boolean> {
  let cursor: string | null = null;
  for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
    const data: ItemsPageQueryData = await mondayRequest<ItemsPageQueryData>(
      ITEMS_PAGE_QUERY,
      {
        boardId,
        cursor,
        limit: pageSize,
        columnId: [columnId],
      }
    );
    const firstBoard = Array.isArray(data.boards) ? data.boards[0] : undefined;
    const page = firstBoard?.items_page;
    const items: MondayItem[] = page?.items ?? [];
    if (
      items.some((item) =>
        item.column_values?.some(
          (columnValue: MondayColumnValue) => columnValue.text === userId
        )
      )
    ) {
      return true;
    }
    cursor = page?.cursor || null;
    if (!cursor) break; // No more pages
  }
  return false;
}

export async function mondayQueryRaw<
  TData = unknown,
  TVars extends Record<string, unknown> = Record<string, unknown>
>(query: string, variables?: TVars) {
  return mondayRequest<TData, TVars>(query, variables);
}

// Create an item representing a claimed gift. Column mapping assumptions:
// text  -> userId
// text1 -> gift title
export async function createClaimItem(
  boardId: string,
  userId: string,
  giftTitle: string
): Promise<CreateItemResponse> {
  const mutation = `
    mutation($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) { id }
    }
  `;
  // Determine which column IDs to use. Fall back to Monday default textual columns ("text", "text1")
  // if environment variables for specific IDs are not provided.
  const userColumnId = config.CLAIMS_BOARD_USER_ID_COLUMN_ID || "text"; // user id / identity
  const giftTitleColumnId = config.CLAIMS_BOARD_GIFT_TITLE_COLUMN_ID || "text1"; // gift title

  // Monday API expects column_values to be a JSON string where keys are column ids and
  // values are the raw value (for simple text columns just a string) or an object depending on type.
  const columnValues = JSON.stringify({
    [userColumnId]: userId,
    [giftTitleColumnId]: giftTitle,
  });

  return mondayRequest<
    CreateItemResponse,
    {
      boardId: string;
      itemName: string;
      columnValues: string;
    }
  >(mutation, {
    boardId,
    itemName: `${giftTitle}`,
    columnValues,
  });
}

// Count number of claimed items per gift title in the claims board.
export async function countClaimsByGiftTitle(): Promise<
  Record<string, number>
> {
  const claimsBoardId = config.CLAIMS_BOARD_ID;
  if (!claimsBoardId) return {};

  // We only need the gift title column to aggregate counts. Default to "text1".
  const giftTitleColumnId = config.CLAIMS_BOARD_GIFT_TITLE_COLUMN_ID || "text1";

  let cursor: string | null = null;
  const limit = 500;
  const counts: Record<string, number> = {};
  for (let i = 0; i < 50; i++) {
    const data: ItemsPageQueryData = await mondayRequest<ItemsPageQueryData>(
      ITEMS_PAGE_QUERY,
      {
        boardId: claimsBoardId,
        cursor,
        limit,
        columnId: [giftTitleColumnId],
      }
    );
    const items = data?.boards?.[0]?.items_page?.items ?? [];
    for (const item of items) {
      const title =
        item.column_values?.find((c) => c.id === giftTitleColumnId)?.text || "";
      if (!title) continue;
      counts[title] = (counts[title] || 0) + 1;
    }
    cursor = data?.boards?.[0]?.items_page?.cursor || null;
    if (!cursor) break;
  }
  return counts;
}

// Compute remaining quantities for each configured gift by subtracting claims.
export async function getGiftsWithRemaining(): Promise<Gift[]> {
  // If an inventory board is configured, prefer using its live stock numbers
  if (
    config.INVENTORY_BOARD_ID &&
    config.INVENTORY_GIFT_ID_COLUMN_ID &&
    config.INVENTORY_STOCK_COLUMN_ID
  ) {
    const inventory = await getInventoryMap();
    return baseGifts.map((g) => {
      const stockStr = inventory.get(g.id);
      const stock = stockStr != null ? Number(stockStr) : g.stock ?? 0;
      const remaining = Math.max(0, Number.isFinite(stock) ? stock : 0);
      return { ...g, remaining };
    });
  }

  // Fallback to static stock minus claims board aggregation
  const counts = await countClaimsByGiftTitle();
  return baseGifts.map((g) => {
    const stock = g.stock ?? 0;
    const claimed = counts[g.title] || 0;
    const remaining = Math.max(0, stock - claimed);
    return { ...g, remaining };
  });
}

// ---------- Inventory board helpers ----------

// Fetch the full inventory board into a Map<giftId, stockText>
export async function getInventoryMap(): Promise<Map<string, string>> {
  const res = new Map<string, string>();
  const boardId = config.INVENTORY_BOARD_ID!;
  const giftIdCol = config.INVENTORY_GIFT_ID_COLUMN_ID!;
  const stockCol = config.INVENTORY_STOCK_COLUMN_ID!;
  let cursor: string | null = null;
  const limit = 500;
  for (let i = 0; i < 50; i++) {
    const data: ItemsPageQueryData = await mondayRequest(ITEMS_PAGE_QUERY, {
      boardId,
      cursor,
      limit,
      columnId: [giftIdCol, stockCol],
    });
    const items = data?.boards?.[0]?.items_page?.items ?? [];
    for (const item of items) {
      const giftId = item.column_values?.find((c) => c.id === giftIdCol)?.text;
      const stockText = item.column_values?.find(
        (c) => c.id === stockCol
      )?.text;
      if (giftId) res.set(giftId, stockText ?? "0");
    }
    cursor = data?.boards?.[0]?.items_page?.cursor || null;
    if (!cursor) break;
  }
  return res;
}

async function findInventoryItemIdByGiftId(
  giftId: string
): Promise<string | null> {
  const boardId = config.INVENTORY_BOARD_ID!;
  const giftIdCol = config.INVENTORY_GIFT_ID_COLUMN_ID!;
  let cursor: string | null = null;
  const limit = 500;
  for (let i = 0; i < 50; i++) {
    const data: ItemsPageQueryData = await mondayRequest(ITEMS_PAGE_QUERY, {
      boardId,
      cursor,
      limit,
      columnId: [giftIdCol],
    });
    const items = data?.boards?.[0]?.items_page?.items ?? [];
    for (const item of items) {
      const idText = item.column_values?.find((c) => c.id === giftIdCol)?.text;
      if (idText === giftId) return item.id;
    }
    cursor = data?.boards?.[0]?.items_page?.cursor || null;
    if (!cursor) break;
  }
  return null;
}

export async function getCurrentStockForGiftId(
  giftId: string
): Promise<number | null> {
  if (
    !config.INVENTORY_BOARD_ID ||
    !config.INVENTORY_GIFT_ID_COLUMN_ID ||
    !config.INVENTORY_STOCK_COLUMN_ID
  )
    return null;
  const itemId = await findInventoryItemIdByGiftId(giftId);
  if (!itemId) return null;
  const stockCol = config.INVENTORY_STOCK_COLUMN_ID!;
  // Fetch just the stock column value for this item
  const query = `
    query($ids:[ID!], $columnId:[String!]){
      items(ids:$ids){ id column_values(ids:$columnId){ id text } }
    }
  `;
  const data = await mondayQueryRaw<{ items: MondayItem[] }>(query, {
    ids: [itemId],
    columnId: [stockCol],
  });
  const items: MondayItem[] = data?.items ?? [];
  const stockText: string | undefined = items?.[0]?.column_values?.[0]?.text;
  const n = Number(stockText);
  return Number.isFinite(n) ? n : 0;
}

// Atomically decrement stock for a gift by 1. Throws if no stock.
export async function decrementInventoryForGiftId(
  giftId: string
): Promise<void> {
  if (
    !config.INVENTORY_BOARD_ID ||
    !config.INVENTORY_GIFT_ID_COLUMN_ID ||
    !config.INVENTORY_STOCK_COLUMN_ID
  )
    throw new Error("Inventory board is not configured");

  const itemId = await findInventoryItemIdByGiftId(giftId);
  if (!itemId) throw new Error("Gift not found in inventory");

  const boardId = config.INVENTORY_BOARD_ID!;
  const stockCol = config.INVENTORY_STOCK_COLUMN_ID!;

  // First read current stock directly to guard
  const current = await getCurrentStockForGiftId(giftId);
  if (current == null || current <= 0) {
    throw new Error("המתנה אזלה מהמלאי");
  }

  const next = current - 1;
  // Update via change_multiple_column_values mutation
  const mutation = `
    mutation($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) { id }
    }
  `;
  // Numbers column expects a numeric string
  const columnValues = JSON.stringify({ [stockCol]: String(next) });
  await mondayRequest(mutation, { boardId, itemId, columnValues });
}

// Best-effort compensation to add 1 back to stock
export async function incrementInventoryForGiftId(
  giftId: string
): Promise<void> {
  if (
    !config.INVENTORY_BOARD_ID ||
    !config.INVENTORY_GIFT_ID_COLUMN_ID ||
    !config.INVENTORY_STOCK_COLUMN_ID
  )
    return;
  const itemId = await findInventoryItemIdByGiftId(giftId);
  if (!itemId) return;
  const boardId = config.INVENTORY_BOARD_ID!;
  const stockCol = config.INVENTORY_STOCK_COLUMN_ID!;
  const current = await getCurrentStockForGiftId(giftId);
  const next = (current ?? 0) + 1;
  const mutation = `
    mutation($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) { id }
    }
  `;
  const columnValues = JSON.stringify({ [stockCol]: String(next) });
  await mondayRequest(mutation, { boardId, itemId, columnValues });
}
