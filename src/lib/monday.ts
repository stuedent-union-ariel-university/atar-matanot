import { config } from "./config";
import type {
  MondayColumnValue,
  MondayItem,
  MondayGraphQLError,
  ItemsPageQueryData,
  CreateItemResponse,
} from "@/types/monday";

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
