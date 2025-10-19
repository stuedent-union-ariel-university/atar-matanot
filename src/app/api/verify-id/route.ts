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

    if (
      !MONDAY_API_KEY ||
      !USER_BOARD_ID ||
      !USER_BOARD_USER_ID_COLUMN_ID ||
      !FORM_BOARD_ID ||
      !FORM_BOARD_USER_ID_COLUMN_ID ||
      !CLAIMS_BOARD_ID ||
      !CLAIMS_BOARD_USER_ID_COLUMN_ID
    ) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "מספר זהות נדרש" }, { status: 400 });
    }

    // Check the three conditions in parallel for efficiency
    const [inUserBoard, inFormBoard, alreadyClaimed] = await Promise.all([
      findUserInBoardByColumnValues(
        USER_BOARD_ID,
        USER_BOARD_USER_ID_COLUMN_ID,
        userId
      ),
      findUserInBoardByColumnValues(
        FORM_BOARD_ID,
        FORM_BOARD_USER_ID_COLUMN_ID,
        userId
      ),
      findUserInBoardByColumnValues(
        CLAIMS_BOARD_ID,
        CLAIMS_BOARD_USER_ID_COLUMN_ID,
        userId
      ),
    ]);

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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
