import { config, isSubmissionClosed } from "@/lib/config";
import { NextResponse } from "next/server";
import {
  createClaimItem,
  countClaimsByGiftTitle,
  decrementInventoryForGiftId,
  incrementInventoryForGiftId,
  findUserInBoardByColumnValues,
  getUserNameById,
  isInventoryConfigured,
} from "@/lib/monday";
import { gifts } from "@/lib/gifts";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // A legitimate user submits once; allow a little slack for retries.
    const limited = checkRateLimit(request, "submit-gift", {
      limit: 5,
      windowMs: 60_000,
    });
    if (limited) return limited;

    // Check if the submission deadline has passed
    if (isSubmissionClosed()) {
      return NextResponse.json(
        { error: "מועד בחירת המתנות הסתיים ב-1 במרץ 2026" },
        { status: 403 },
      );
    }

    if (!config.MONDAY_API_KEY || !config.CLAIMS_BOARD_ID) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { userId, giftId } = body;

    if (
      typeof userId !== "string" ||
      typeof giftId !== "string" ||
      !/^[0-9]{7,10}$/.test(userId.trim())
    ) {
      return NextResponse.json(
        { error: "מספר זהות ומזהה מתנה נדרשים" },
        { status: 400 },
      );
    }
    const normalizedUserId = userId.trim();

    // Resolve gift title from provided giftId
    const gift = gifts.find((g) => g.id === giftId);
    if (!gift) {
      return NextResponse.json({ error: "מתנה לא נמצאה" }, { status: 400 });
    }

    // Re-verify eligibility server-side: the user must appear in the user board.
    if (config.USER_BOARD_ID && config.USER_BOARD_USER_ID_COLUMN_ID) {
      const eligible = await findUserInBoardByColumnValues(
        config.USER_BOARD_ID,
        config.USER_BOARD_USER_ID_COLUMN_ID,
        normalizedUserId,
      );
      if (!eligible) {
        return NextResponse.json(
          { error: "לא נמצאת/ת ברשימת הזכאים" },
          { status: 403 },
        );
      }
    }

    // Check if user has already claimed a gift (server-side filtered, covers the whole board)
    const userColumnId = config.CLAIMS_BOARD_USER_ID_COLUMN_ID || "text";
    const alreadyClaimed = await findUserInBoardByColumnValues(
      config.CLAIMS_BOARD_ID,
      userColumnId,
      normalizedUserId,
    );
    if (alreadyClaimed) {
      return NextResponse.json(
        { error: "כבר בחרת מתנה בעבר" },
        { status: 400 },
      );
    }

    if (isInventoryConfigured()) {
      // Decrement live stock; throws when the gift is out of stock
      try {
        await decrementInventoryForGiftId(gift.id);
      } catch (e) {
        return NextResponse.json(
          { error: (e as Error).message || "המתנה אזלה מהמלאי" },
          { status: 409 },
        );
      }
    } else {
      // Fallback to static stock - claims aggregation
      const counts = await countClaimsByGiftTitle();
      const stock = gift.stock ?? 0;
      const claimed = counts[gift.title] || 0;
      if (stock - claimed <= 0) {
        return NextResponse.json(
          { error: "המתנה אזלה מהמלאי" },
          { status: 409 },
        );
      }
    }

    // Fetch user name (best-effort) to store on claims board
    let userName: string | null = null;
    try {
      userName = await getUserNameById(normalizedUserId);
    } catch {}

    // Create new item in claims board to log the redemption; include user name if available
    try {
      await createClaimItem(
        config.CLAIMS_BOARD_ID,
        normalizedUserId,
        gift.title,
        userName ?? undefined,
      );
    } catch (e) {
      // Compensation: if inventory was decremented, add it back
      if (isInventoryConfigured()) {
        try {
          await incrementInventoryForGiftId(gift.id);
        } catch {}
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting gift:", error);
    return NextResponse.json(
      { error: "אירעה שגיאה בשמירת הבחירה" },
      { status: 500 },
    );
  }
}
