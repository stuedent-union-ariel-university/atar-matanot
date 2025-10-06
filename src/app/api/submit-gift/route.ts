/* eslint-disable @typescript-eslint/no-explicit-any */
import { config } from "@/lib/config";
import { NextResponse } from "next/server";
import {
  mondayQueryRaw,
  createClaimItem,
  countClaimsByGiftTitle,
} from "@/lib/monday";
import { gifts } from "@/lib/gifts";

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

    const checkQuery = `
      query($boardId: [ID!], $columnIds: [String!], $limit: Int) {
        boards(ids: $boardId) {
          id
          items_page(limit: $limit) {
            items {
              id
              column_values(ids: $columnIds) {
                id
                text
              }
            }
          }
        }
      }
    `;

    const checkResult: any = await mondayQueryRaw(checkQuery, {
      boardId: config.CLAIMS_BOARD_ID,
      columnIds: Array.from(new Set([userColumnId, giftTitleColumnId])),
      limit: 500,
    });

    const items = checkResult?.data?.boards?.[0]?.items_page?.items || [];
    const existingClaim = items.find((item: any) =>
      item.column_values?.some(
        (col: any) => col.id === userColumnId && col.text === userId
      )
    );

    if (existingClaim) {
      return NextResponse.json(
        { error: "כבר בחרת מתנה בעבר" },
        { status: 400 }
      );
    }

    // Concurrency guard: ensure stock remains before creating claim
    const counts = await countClaimsByGiftTitle();
    const stock = gift.stock ?? 0;
    const claimed = counts[gift.title] || 0;
    const remaining = stock - claimed;
    if (remaining <= 0) {
      return NextResponse.json({ error: "המתנה אזלה מהמלאי" }, { status: 409 });
    }

    // Create new item in claims board
    await createClaimItem(config.CLAIMS_BOARD_ID, userId, gift.title);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting gift:", error);
    return NextResponse.json(
      { error: "אירעה שגיאה בשמירת הבחירה" },
      { status: 500 }
    );
  }
}
