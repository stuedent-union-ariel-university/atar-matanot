/* eslint-disable @typescript-eslint/no-explicit-any */
import { config } from "@/lib/config";
import { NextResponse } from "next/server";
import {
  mondayQueryRaw,
  createClaimItem,
  countClaimsByGiftTitle,
  decrementInventoryForGiftId,
  getCurrentStockForGiftId,
  incrementInventoryForGiftId,
} from "@/lib/monday";
import { gifts } from "@/lib/gifts";
import { findUserInBoard } from "@/lib/monday";

// Edge runtime reduces cold starts for user submissions
export const runtime = "edge";
export const preferredRegion = ["fra1"];

export async function POST(request: Request) {
  try {
    if (!config.MONDAY_API_KEY || !config.CLAIMS_BOARD_ID) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { userId, giftId } = body;

    if (!userId || !giftId) {
      return NextResponse.json(
        { error: "מספר זהות ומזהה מתנה נדרשים" },
        { status: 400 }
      );
    }

    // Resolve gift title from provided giftId
    const gift = gifts.find((g) => g.id === giftId);
    if (!gift) {
      return NextResponse.json({ error: "מתנה לא נמצאה" }, { status: 400 });
    }

    // Check if user has already claimed a gift. Use configured column ids (fallback to defaults)
    const userColumnId = config.CLAIMS_BOARD_USER_ID_COLUMN_ID || "text";
    const giftTitleColumnId =
      config.CLAIMS_BOARD_GIFT_TITLE_COLUMN_ID || "text1";

    // Fast existence check using Monday's items_by_column_values API
    const hasClaim = await findUserInBoard(
      config.CLAIMS_BOARD_ID,
      userColumnId,
      userId,
      undefined,
      undefined,
      undefined
    );
    if (hasClaim) {
      return NextResponse.json(
        { error: "כבר בחרת מתנה בעבר" },
        { status: 400 }
      );
    }

    if (
      config.INVENTORY_BOARD_ID &&
      config.INVENTORY_GIFT_ID_COLUMN_ID &&
      config.INVENTORY_STOCK_COLUMN_ID
    ) {
      const current = await getCurrentStockForGiftId(gift.id);
      if (current == null || current <= 0) {
        return NextResponse.json(
          { error: "המתנה אזלה מהמלאי" },
          { status: 409 }
        );
      }
    } else {
      // Fallback to static stock - claims aggregation
      const counts = await countClaimsByGiftTitle();
      const stock = gift.stock ?? 0;
      const claimed = counts[gift.title] || 0;
      const remaining = stock - claimed;
      if (remaining <= 0) {
        return NextResponse.json(
          { error: "המתנה אזלה מהמלאי" },
          { status: 409 }
        );
      }
    }

    // If inventory board configured, decrement atomically before writing claim
    if (
      config.INVENTORY_BOARD_ID &&
      config.INVENTORY_GIFT_ID_COLUMN_ID &&
      config.INVENTORY_STOCK_COLUMN_ID
    ) {
      try {
        await decrementInventoryForGiftId(gift.id);
      } catch (e) {
        return NextResponse.json(
          { error: (e as Error).message || "המתנה אזלה מהמלאי" },
          { status: 409 }
        );
      }
    }

    // Create new item in claims board to log the redemption
    try {
      await createClaimItem(config.CLAIMS_BOARD_ID, userId, gift.title);
    } catch (e) {
      // Compensation: if inventory was decremented, add it back
      if (
        config.INVENTORY_BOARD_ID &&
        config.INVENTORY_GIFT_ID_COLUMN_ID &&
        config.INVENTORY_STOCK_COLUMN_ID
      ) {
        try {
          await incrementInventoryForGiftId(gift.id);
        } catch {}
      }
      throw e;
    }

    const res = NextResponse.json({ success: true });
    return res;
  } catch (error) {
    console.error("Error submitting gift:", error);
    return NextResponse.json(
      { error: "השירות עמוס כרגע, נסה/י שוב" },
      { status: 503 }
    );
  }
}
