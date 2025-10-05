// Shared type definitions for Monday.com GraphQL interactions

export interface MondayColumnValue {
  id: string;
  text: string;
}

export interface MondayItem {
  id: string;
  column_values: MondayColumnValue[];
}

export interface ItemsPage {
  cursor: string | null;
  items: MondayItem[];
}

export interface ItemsPageQueryData {
  boards?: Array<{
    items_page?: ItemsPage;
  }>;
}

export interface MondayGraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
}

export interface CreateItemResponse {
  create_item: { id: string };
}

export interface CreateItemDataWrapper {
  data: CreateItemResponse;
  errors?: MondayGraphQLError[];
}
