import { config } from "@/lib/config";
import { NextResponse } from "next/server";
import { findUserInBoard } from "@/lib/monday";

export async function GET(request: Request) {
  try {
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

    const eligible = await findUserInBoard(
      USER_BOARD_ID,
      USER_BOARD_USER_ID_COLUMN_ID,
      userId
    );
    if (!eligible)
      return NextResponse.json(
        { error: "נראה שאתה לא ברשימת משלמי דמי הרווחה" },
        { status: 403 }
      );

    const claimed = await findUserInBoard(
      CLAIMS_BOARD_ID,
      CLAIMS_BOARD_USER_ID_COLUMN_ID,
      userId
    );
    if (claimed)
      return NextResponse.json({ error: "כבר בחרת מתנה" }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
