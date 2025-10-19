export const config = {
  MONDAY_API_URL: "https://api.monday.com/v2",
  API_CHECK_GIFT_URL: "/api/check-gift",
  API_VERIFY_ID_URL: "/api/verify-id",
  API_SUBMIT_GIFT_URL: "/api/submit-gift",
  API_GIFTS_URL: "/api/gifts",
  MONDAY_API_KEY: process.env.MONDAY_API_KEY,
  USER_BOARD_ID: process.env.MONDAY_USER_BOARD_ID,
  // An additional board to cross-verify user eligibility (e.g., form responders)
  FORM_BOARD_ID: process.env.MONDAY_FORM_BOARD_ID,
  CLAIMS_BOARD_ID: process.env.MONDAY_CLAIMS_BOARD_ID,
  USER_BOARD_USER_ID_COLUMN_ID: process.env.MONDAY_USER_BOARD_USER_ID_COLUMN_ID,
  USER_BOARD_USER_NAME_COLUMN_ID:
    process.env.MONDAY_USER_BOARD_USER_NAME_COLUMN_ID,
  FORM_BOARD_USER_ID_COLUMN_ID: process.env.MONDAY_FORM_BOARD_USER_ID_COLUMN_ID,
  CLAIMS_BOARD_USER_ID_COLUMN_ID:
    process.env.MONDAY_CLAIMS_BOARD_USER_ID_COLUMN_ID,
  CLAIMS_BOARD_GIFT_TITLE_COLUMN_ID:
    process.env.MONDAY_CLAIMS_BOARD_GIFT_TITLE_COLUMN_ID,
  // Inventory board config: a board where each item represents a gift, with columns for gift id and stock
  INVENTORY_BOARD_ID: process.env.MONDAY_INVENTORY_BOARD_ID,
  INVENTORY_GIFT_ID_COLUMN_ID: process.env.MONDAY_INVENTORY_GIFT_ID_COLUMN_ID, // typically a Text column
  INVENTORY_STOCK_COLUMN_ID: process.env.MONDAY_INVENTORY_STOCK_COLUMN_ID, // typically a Numbers column
};
