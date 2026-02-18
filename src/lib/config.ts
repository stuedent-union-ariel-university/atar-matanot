export const config = {
  MONDAY_API_URL: "https://api.monday.com/v2",
  API_CHECK_GIFT_URL: "/api/check-gift",
  API_VERIFY_ID_URL: "/api/verify-id",
  API_SUBMIT_GIFT_URL: "/api/submit-gift",
  API_GIFTS_URL: "/api/gifts",
  MONDAY_API_KEY: process.env.MONDAY_API_KEY,
  USER_BOARD_ID: process.env.MONDAY_USER_BOARD_ID,
  CLAIMS_BOARD_ID: process.env.MONDAY_CLAIMS_BOARD_ID,
  USER_BOARD_USER_ID_COLUMN_ID: process.env.MONDAY_USER_BOARD_USER_ID_COLUMN_ID,
  USER_BOARD_USER_NAME_COLUMN_ID:
    process.env.MONDAY_USER_BOARD_USER_NAME_COLUMN_ID,
  CLAIMS_BOARD_USER_ID_COLUMN_ID:
    process.env.MONDAY_CLAIMS_BOARD_USER_ID_COLUMN_ID,
  CLAIMS_BOARD_GIFT_TITLE_COLUMN_ID:
    process.env.MONDAY_CLAIMS_BOARD_GIFT_TITLE_COLUMN_ID,
  // Optional: a column on the claims board to store the user's full name
  CLAIMS_BOARD_USER_NAME_COLUMN_ID:
    process.env.MONDAY_CLAIMS_BOARD_USER_NAME_COLUMN_ID,
  // Inventory board config: a board where each item represents a gift, with columns for gift id and stock
  INVENTORY_BOARD_ID: process.env.MONDAY_INVENTORY_BOARD_ID,
  INVENTORY_GIFT_ID_COLUMN_ID: process.env.MONDAY_INVENTORY_GIFT_ID_COLUMN_ID, // typically a Text column
  INVENTORY_STOCK_COLUMN_ID: process.env.MONDAY_INVENTORY_STOCK_COLUMN_ID, // typically a Numbers column
  // March 1st, 2026, at midnight (Israel time)
  SUBMISSION_DEADLINE: "2026-03-01T00:00:00+02:00",
};
