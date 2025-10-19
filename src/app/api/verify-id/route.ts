import { NextResponse } from "next/server";

// Run this route on the Edge Runtime for faster cold starts
export const runtime = "edge";
export const preferredRegion = ["fra1"];
import { config } from "@/lib/config";
import { findUserInBoard } from "@/lib/monday";

// Verify user ID by checking it appears in BOTH the user board and the form board,
// and has NOT appeared yet in the claims board.
export async function GET(request: Request) {
  try {
    const reqStart = Date.now();
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

    // First check claims board; if already claimed, short-circuit early
    const t1 = Date.now();
    const alreadyClaimed = await findUserInBoard(
      CLAIMS_BOARD_ID,
      CLAIMS_BOARD_USER_ID_COLUMN_ID,
      userId,
      undefined,
      undefined,
      undefined
    );
    const tClaim = Date.now();
    if (alreadyClaimed) {
      const res = NextResponse.json(
        { error: "כבר בחרת מתנה" },
        { status: 400 }
      );
      res.headers.set("x-timing-verify-claims-ms", String(tClaim - t1));
      res.headers.set(
        "x-timing-verify-total-ms",
        String(Date.now() - reqStart)
      );
      return res;
    }

    // Check the two eligibility boards in parallel
    const [inUserBoard, inFormBoard] = await Promise.all([
      findUserInBoard(
        USER_BOARD_ID,
        USER_BOARD_USER_ID_COLUMN_ID,
        userId,
        undefined,
        undefined,
        undefined
      ),
      findUserInBoard(
        FORM_BOARD_ID,
        FORM_BOARD_USER_ID_COLUMN_ID,
        userId,
        undefined,
        undefined,
        undefined
      ),
    ]);
    const tElig = Date.now();

    if (!inUserBoard) {
      const res = NextResponse.json(
        { error: "לא נמצאת/ת ברשימת הזכאים" },
        { status: 403 }
      );
      res.headers.set("x-timing-verify-elig-ms", String(tElig - tClaim));
      res.headers.set(
        "x-timing-verify-total-ms",
        String(Date.now() - reqStart)
      );
      return res;
    }
    if (!inFormBoard) {
      const res = NextResponse.json(
        { error: "לא נמצאה תשובה בסקר האגודה" },
        { status: 403 }
      );
      res.headers.set("x-timing-verify-elig-ms", String(tElig - tClaim));
      res.headers.set(
        "x-timing-verify-total-ms",
        String(Date.now() - reqStart)
      );
      return res;
    }
    const res = NextResponse.json({ success: true });
    res.headers.set("x-timing-verify-elig-ms", String(tElig - tClaim));
    res.headers.set("x-timing-verify-total-ms", String(Date.now() - reqStart));
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: "שירות האימות איטי כרגע, נסה/י שוב בעוד רגע" },
      { status: 503 }
    );
  }
}
