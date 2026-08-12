import { config, isSubmissionClosed } from "@/lib/config";
import { NextResponse } from "next/server";
import {
  createClaimItem,
  countClaimsByGiftTitle,
  decrementInventoryForGiftId,
  incrementInventoryForGiftId,
  isInventoryConfigured,
} from "@/lib/monday";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { gifts as staticGifts } from "@/lib/gifts";

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

    // Resolve gift from the DB catalog
    const gift = await prisma.gift.findUnique({ where: { id: giftId } });
    if (!gift) {
      return NextResponse.json({ error: "מתנה לא נמצאה" }, { status: 400 });
    }

    // Re-verify eligibility server-side against the DB source of truth.
    const user = await prisma.user.findUnique({
      where: { id: normalizedUserId },
    });
    if (!user) {
      return NextResponse.json(
        { error: "לא נמצאת/ת ברשימת הזכאים" },
        { status: 403 },
      );
    }

    // Check if user has already claimed a gift
    const alreadyClaimed = await prisma.giftRequest.findUnique({
      where: { userId: normalizedUserId },
    });
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
      // Fallback to static stock - claims aggregation (no live inventory board configured)
      const counts = await countClaimsByGiftTitle();
      const stock = staticGifts.find((g) => g.id === gift.id)?.stock ?? 0;
      const claimed = counts[gift.title] || 0;
      if (stock - claimed <= 0) {
        return NextResponse.json(
          { error: "המתנה אזלה מהמלאי" },
          { status: 409 },
        );
      }
    }

    // Write the gift request to the DB — this is the record of truth.
    let giftRequest;
    try {
      giftRequest = await prisma.giftRequest.create({
        data: { userId: normalizedUserId, giftId: gift.id },
      });
    } catch (e) {
      // Compensation: if inventory was decremented, add it back
      if (isInventoryConfigured()) {
        try {
          await incrementInventoryForGiftId(gift.id);
        } catch {}
      }
      // Unique constraint violation = a concurrent request beat us to it
      return NextResponse.json(
        { error: "כבר בחרת מתנה בעבר" },
        { status: 400 },
      );
    }

    // Best-effort mirror into the Monday claims board. Failures here don't
    // fail the request or roll anything back — the DB row above is the
    // source of truth for the gift request.
    if (config.MONDAY_API_KEY && config.CLAIMS_BOARD_ID) {
      try {
        const created = await createClaimItem(
          config.CLAIMS_BOARD_ID,
          normalizedUserId,
          gift.title,
          user.name ?? undefined,
        );
        await prisma.giftRequest.update({
          where: { id: giftRequest.id },
          data: {
            mondayItemId: created.create_item?.id,
            mondaySyncedAt: new Date(),
          },
        });
      } catch (e) {
        console.error("Failed to mirror gift request to Monday:", e);
        await prisma.giftRequest
          .update({
            where: { id: giftRequest.id },
            data: { mondaySyncError: (e as Error).message?.slice(0, 500) },
          })
          .catch(() => {});
      }
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
