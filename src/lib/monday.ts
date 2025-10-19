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
>(
  query: string,
  variables?: TVars,
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<TData> {
  const ac = new AbortController();
  const timer = setTimeout(
    () => ac.abort(new Error("mondayRequest: timeout")),
    opts?.timeoutMs ?? 8000
  );
  const response = await fetch(config.MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.MONDAY_API_KEY || ""}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: opts?.signal ?? ac.signal,
  }).finally(() => clearTimeout(timer));
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

// A retry-aware variant that handles Monday.com rate limits (HTTP 429 or GraphQL
// errors indicating complexity/rate limiting) and transient 5xx errors.
// Uses exponential backoff with jitter and respects Retry-After when present.
export async function mondayRequestWithRetry<
  TData,
  TVars extends Record<string, unknown> = Record<string, unknown>
>(
  query: string,
  variables?: TVars,
  options?: {
    retries?: number; // total attempts = retries + 1
    minDelayMs?: number; // base backoff
    maxDelayMs?: number; // cap backoff
    jitterMs?: number; // extra random jitter
    signal?: AbortSignal;
    timeoutMsPerAttempt?: number;
  }
): Promise<TData> {
  const {
    retries = 4,
    minDelayMs = 200,
    maxDelayMs = 2500,
    jitterMs = 250,
    signal,
    timeoutMsPerAttempt = 8000,
  } = options || {};

  const sleep = (ms: number) =>
    new Promise<void>((res) => setTimeout(res, Math.max(0, ms)));

  const shouldRetryGraphQLErrors = (messages: string[]): boolean => {
    const msg = messages.join("; ");
    return /rate.?limit|too\s*many\s*requests|complexity|budget|throttle/i.test(
      msg
    );
  };

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt++;
    const ac = new AbortController();
    const timer = setTimeout(
      () => ac.abort(new Error("mondayRequestWithRetry: timeout")),
      timeoutMsPerAttempt
    );
    const response = await fetch(config.MONDAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.MONDAY_API_KEY || ""}`,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: signal ?? ac.signal,
    }).finally(() => clearTimeout(timer));

    // Handle HTTP errors
    if (!response.ok) {
      // 429 or transient 5xx: retry with backoff
      if (
        response.status === 429 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504 ||
        response.status === 500
      ) {
        if (attempt > retries + 1) {
          throw new Error(`HTTP ${response.status}`);
        }
        // Try to honor Retry-After header if present (seconds)
        const retryAfter = response.headers.get("Retry-After");
        const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : NaN;
        const backoff = Math.min(
          maxDelayMs,
          Math.max(
            minDelayMs,
            Number.isFinite(retryAfterMs)
              ? retryAfterMs
              : minDelayMs * Math.pow(2, attempt - 1)
          )
        );
        const jitter = Math.random() * jitterMs;
        await sleep(backoff + jitter);
        continue;
      }
      // Non-retriable
      throw new Error(`HTTP ${response.status}`);
    }

    const json = (await response.json()) as {
      data: TData;
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      if (shouldRetryGraphQLErrors(json.errors.map((e) => e.message))) {
        if (attempt <= retries + 1) {
          const backoff = Math.min(
            maxDelayMs,
            minDelayMs * Math.pow(2, attempt - 1)
          );
          const jitter = Math.random() * jitterMs;
          await sleep(backoff + jitter);
          continue;
        }
      }
      throw new Error(json.errors.map((e) => e.message).join(";"));
    }
    return json.data;
  }
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

// ------- Fast lookups and lightweight caching -------

// A very small in-memory cache for board lookups by exact column value.
// Key: `${boardId}:${columnId}:${value}` -> { value: boolean, expires: number }
// We avoid caching for the claims board to prevent stale "not yet claimed" responses.
type BoolCacheEntry = { value: boolean; expires: number };
const existenceCache = new Map<string, BoolCacheEntry>();

function cacheKey(boardId: string, columnId: string, value: string) {
  return `${boardId}:${columnId}:${value}`;
}

function getCached(boardId: string, columnId: string, value: string) {
  const key = cacheKey(boardId, columnId, value);
  const entry = existenceCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    existenceCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached(
  boardId: string,
  columnId: string,
  value: string,
  result: boolean
) {
  // TTLs: for static boards (users/forms) we can cache longer; for claims board, skip caching
  const isClaims = config.CLAIMS_BOARD_ID && boardId === config.CLAIMS_BOARD_ID;
  if (isClaims) return; // do not cache claims board results to avoid staleness
  const ttlMs = 5 * 60 * 1000; // 5 minutes for eligibility boards
  const key = cacheKey(boardId, columnId, value);
  existenceCache.set(key, { value: result, expires: Date.now() + ttlMs });
}

// Fast exact-match lookup via Monday's items_by_column_values GraphQL API.
// Returns true if any item exists whose column matches the provided value exactly.
async function findExistsByColumnExact(
  boardId: string,
  columnId: string,
  value: string,
  signal?: AbortSignal
): Promise<boolean> {
  // Check cache first (except claims board)
  const cached = getCached(boardId, columnId, value);
  if (typeof cached === "boolean") return cached;

  const query = `
    query($boardId: ID!, $columnId: String!, $value: String!) {
      items_by_column_values(board_id: $boardId, column_id: $columnId, column_value: $value) { id }
    }
  `;
  const data = await mondayRequestWithRetry<
    { items_by_column_values?: Array<{ id: string }> },
    { boardId: string; columnId: string; value: string }
  >(query, { boardId, columnId, value }, { signal });
  const exists = (data.items_by_column_values?.length ?? 0) > 0;
  setCached(boardId, columnId, value, exists);
  return exists;
}

export async function findUserInBoard(
  boardId: string,
  columnId: string,
  userId: string,
  pageSize = 500,
  maxPages = 25
): Promise<boolean> {
  // Try the fast path first using items_by_column_values with retries
  try {
    return await findExistsByColumnExact(boardId, columnId, userId);
  } catch {
    // fall back to paginated scan below
  }

  let cursor: string | null = null;
  for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
    const data: ItemsPageQueryData =
      await mondayRequestWithRetry<ItemsPageQueryData>(ITEMS_PAGE_QUERY, {
        boardId,
        cursor,
        limit: pageSize,
        columnId: [columnId],
      });
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
      setCached(boardId, columnId, userId, true);
      return true;
    }
    cursor = page?.cursor || null;
    if (!cursor) break; // No more pages
  }
  setCached(boardId, columnId, userId, false);
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
    const data: ItemsPageQueryData =
      await mondayRequestWithRetry<ItemsPageQueryData>(
        ITEMS_PAGE_QUERY,
        {
          boardId: claimsBoardId,
          cursor,
          limit,
          columnId: [giftTitleColumnId],
        },
        { timeoutMsPerAttempt: 6000, retries: 2 }
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
      const stock =
        stockStr != null
          ? Number((stockStr ?? "").replace(/[^0-9.-]/g, ""))
          : g.stock ?? 0;
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
    const data: ItemsPageQueryData = await mondayRequestWithRetry(
      ITEMS_PAGE_QUERY,
      {
        boardId,
        cursor,
        limit,
        columnId: [giftIdCol, stockCol],
      },
      { timeoutMsPerAttempt: 6000, retries: 2 }
    );
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
    const data: ItemsPageQueryData = await mondayRequestWithRetry(
      ITEMS_PAGE_QUERY,
      {
        boardId,
        cursor,
        limit,
        columnId: [giftIdCol],
      },
      { timeoutMsPerAttempt: 6000, retries: 2 }
    );
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
  // Be robust to thousand separators or other formatting returned by Monday
  const cleaned = (stockText ?? "").replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
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

  // Try 1: change_simple_column_value
  try {
    const mutation1 = `
      mutation($boardId: ID!, $itemId: ID!, $columnId: String!, $value: String!) {
        change_simple_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) { id }
      }
    `;
    await mondayRequest(mutation1, {
      boardId,
      itemId,
      columnId: stockCol,
      value: String(next),
    });
    const after1 = await getCurrentStockForGiftId(giftId);
    if (after1 === next) return;
  } catch (e) {
    // proceed to next attempt
  }

  // Try 2: change_multiple_column_values with simple numeric string
  try {
    const mutation2 = `
      mutation($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) { id }
      }
    `;
    const columnValues = JSON.stringify({ [stockCol]: String(next) });
    await mondayRequest(mutation2, { boardId, itemId, columnValues });
    const after2 = await getCurrentStockForGiftId(giftId);
    if (after2 === next) return;
  } catch (e) {
    // proceed to next attempt
  }

  // Try 3: change_column_value sending a JSON string value
  try {
    const mutation3 = `
      mutation($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
        change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) { id }
      }
    `;
    // For simple columns like Numbers, pass a JSON string representing the raw value
    const value = JSON.stringify(String(next));
    await mondayRequest(mutation3, {
      boardId,
      itemId,
      columnId: stockCol,
      value,
    });
    const after3 = await getCurrentStockForGiftId(giftId);
    if (after3 === next) return;
  } catch (e) {
    // fallthrough
  }

  throw new Error("עדכון המלאי נכשל");
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
    mutation($boardId: ID!, $itemId: ID!, $columnId: String!, $value: String!) {
      change_simple_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) { id }
    }
  `;
  await mondayRequest(mutation, {
    boardId,
    itemId,
    columnId: stockCol,
    value: String(next),
  });
}
