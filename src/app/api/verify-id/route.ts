import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { findUserInBoardByColumnValues } from "@/lib/monday";

// Verify user ID by checking it appears in BOTH the user board and the form board,
// and has NOT appeared yet in the claims board.
export async function GET(request: Request) {
  try {
    const {
      MONDAY_API_KEY,
      USER_BOARD_ID,
      USER_BOARD_USER_ID_COLUMN_ID,
      FORM_BOARD_ID,
      FORM_BOARD_USER_ID_COLUMN_ID,
      CLAIMS_BOARD_ID,
      CLAIMS_BOARD_USER_ID_COLUMN_ID,
    } = config;

    const missing: string[] = [];
    if (!MONDAY_API_KEY) missing.push("MONDAY_API_KEY");
    if (!USER_BOARD_ID) missing.push("USER_BOARD_ID");
    if (!USER_BOARD_USER_ID_COLUMN_ID)
      missing.push("USER_BOARD_USER_ID_COLUMN_ID");
    if (!FORM_BOARD_ID) missing.push("FORM_BOARD_ID");
    if (!FORM_BOARD_USER_ID_COLUMN_ID)
      missing.push("FORM_BOARD_USER_ID_COLUMN_ID");
    if (!CLAIMS_BOARD_ID) missing.push("CLAIMS_BOARD_ID");
    if (!CLAIMS_BOARD_USER_ID_COLUMN_ID)
      missing.push("CLAIMS_BOARD_USER_ID_COLUMN_ID");
    if (missing.length) {
      console.error("[verify-id] Missing configuration:", missing);
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Safe non-null locals after validation above
    const userBoardId = USER_BOARD_ID!;
    const userBoardUserIdColumnId = USER_BOARD_USER_ID_COLUMN_ID!;
    const formBoardId = FORM_BOARD_ID!;
    const formBoardUserIdColumnId = FORM_BOARD_USER_ID_COLUMN_ID!;
    const claimsBoardId = CLAIMS_BOARD_ID!;
    const claimsBoardUserIdColumnId = CLAIMS_BOARD_USER_ID_COLUMN_ID!;

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "מספר זהות נדרש" }, { status: 400 });
    }

    console.info("[verify-id] Start", { userId });

    // Run checks sequentially to log precisely where failures occur (behavior unchanged)
    let inUserBoard = false;
    try {
      inUserBoard = await findUserInBoardByColumnValues(
        userBoardId,
        userBoardUserIdColumnId,
        userId
      );
      console.info("[verify-id] user board check", {
        boardId: userBoardId,
        columnId: userBoardUserIdColumnId,
        result: inUserBoard,
      });
    } catch (err) {
      console.error("[verify-id] user board check failed", err);
      throw err;
    }

    let inFormBoard = false;
    try {
      inFormBoard = await findUserInBoardByColumnValues(
        formBoardId,
        formBoardUserIdColumnId,
        userId
      );
      console.info("[verify-id] form board check", {
        boardId: formBoardId,
        columnId: formBoardUserIdColumnId,
        result: inFormBoard,
      });
    } catch (err) {
      console.error("[verify-id] form board check failed", err);
      throw err;
    }

    let alreadyClaimed = false;
    try {
      alreadyClaimed = await findUserInBoardByColumnValues(
        claimsBoardId,
        claimsBoardUserIdColumnId,
        userId
      );
      console.info("[verify-id] claims board check", {
        boardId: claimsBoardId,
        columnId: claimsBoardUserIdColumnId,
        result: alreadyClaimed,
      });
    } catch (err) {
      console.error("[verify-id] claims board check failed", err);
      throw err;
    }

    if (!inUserBoard) {
      return NextResponse.json(
        { error: "לא נמצאת/ת ברשימת הזכאים" },
        { status: 403 }
      );
    }
    if (!inFormBoard) {
      return NextResponse.json(
        { error: "לא נמצאה תשובה בסקר האגודה" },
        { status: 403 }
      );
    }
    if (alreadyClaimed) {
      return NextResponse.json({ error: "כבר בחרת מתנה" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[verify-id] unhandled error", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
