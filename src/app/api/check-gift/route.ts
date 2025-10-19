import { config } from "@/lib/config";
import { NextResponse } from "next/server";
import { findUserInBoard } from "@/lib/monday";

// Run this route on the Edge Runtime for faster cold starts
export const runtime = "edge";
export const preferredRegion = ["fra1"];

export async function GET(request: Request) {
  try {
    const start = Date.now();
    const {
      MONDAY_API_KEY,
      USER_BOARD_ID,
      CLAIMS_BOARD_ID,
      USER_BOARD_USER_ID_COLUMN_ID,
      CLAIMS_BOARD_USER_ID_COLUMN_ID,
    } = config;
    if (
      !MONDAY_API_KEY ||
      !USER_BOARD_ID ||
      !CLAIMS_BOARD_ID ||
      !USER_BOARD_USER_ID_COLUMN_ID ||
      !CLAIMS_BOARD_USER_ID_COLUMN_ID
    ) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId)
      return NextResponse.json({ error: "מספר זהות נדרש" }, { status: 400 });

    // Parallelize both lookups
    const [eligible, claimed] = await Promise.all([
      findUserInBoard(USER_BOARD_ID, USER_BOARD_USER_ID_COLUMN_ID, userId),
      findUserInBoard(CLAIMS_BOARD_ID, CLAIMS_BOARD_USER_ID_COLUMN_ID, userId),
    ]);
    if (!eligible)
      return NextResponse.json(
        { error: "נראה שאתה לא ברשימת משלמי דמי הרווחה" },
        { status: 403 }
      );
    if (claimed)
      return NextResponse.json({ error: "כבר בחרת מתנה" }, { status: 400 });
    const res = NextResponse.json({ success: true });
    res.headers.set("x-timing-check-gift-total-ms", String(Date.now() - start));
    return res;
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
