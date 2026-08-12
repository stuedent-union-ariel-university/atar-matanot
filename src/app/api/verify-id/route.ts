import { NextResponse } from "next/server";
import { isSubmissionClosed } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

// Verify user ID by checking it appears in the Users table,
// and has NOT appeared yet in the GiftRequest table.
export async function GET(request: Request) {
  try {
    // Tight limit: this endpoint reveals which IDs are eligible, so it is
    // the main target for ID enumeration.
    const limited = checkRateLimit(request, "verify-id", {
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;

    // Check if the submission deadline has passed
    if (isSubmissionClosed()) {
      return NextResponse.json(
        { error: "מועד בחירת המתנות הסתיים" },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const rawUserId = url.searchParams.get("userId");
    if (!rawUserId) {
      return NextResponse.json({ error: "מספר זהות נדרש" }, { status: 400 });
    }
    const userId = rawUserId.trim();
    // Validate format before hitting Monday (mirrors submit-gift / login).
    if (!/^[0-9]{7,10}$/.test(userId)) {
      return NextResponse.json(
        { error: "נא להזין מספר זהות חוקי (7-10 ספרות)" },
        { status: 400 },
      );
    }

    // Note: userId is an Israeli national ID (PII) — never log its value.
    console.info("[verify-id] Start");

    // Run checks sequentially to log precisely where failures occur (behavior unchanged)
    let isEligible = false;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      isEligible = Boolean(user);
      console.info("[verify-id] user check", { result: isEligible });
    } catch (err) {
      console.error("[verify-id] user check failed", err);
      throw err;
    }

    let alreadyClaimed = false;
    try {
      const request = await prisma.giftRequest.findUnique({
        where: { userId },
      });
      alreadyClaimed = Boolean(request);
      console.info("[verify-id] gift request check", {
        result: alreadyClaimed,
      });
    } catch (err) {
      console.error("[verify-id] gift request check failed", err);
      throw err;
    }

    if (!isEligible) {
      return NextResponse.json(
        { error: "לא נמצאת/ת ברשימת הזכאים" },
        { status: 403 },
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
      { status: 500 },
    );
  }
}
