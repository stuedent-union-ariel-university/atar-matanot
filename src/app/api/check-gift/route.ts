import { isSubmissionClosed } from "@/lib/config";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const limited = checkRateLimit(request, "check-gift", {
      limit: 20,
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
    if (!rawUserId)
      return NextResponse.json({ error: "מספר זהות נדרש" }, { status: 400 });
    const userId = rawUserId.trim();
    if (!/^[0-9]{7,10}$/.test(userId))
      return NextResponse.json(
        { error: "נא להזין מספר זהות חוקי (7-10 ספרות)" },
        { status: 400 },
      );

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      return NextResponse.json(
        { error: "נראה שאתה לא ברשימת משלמי דמי הרווחה" },
        { status: 403 },
      );

    const claimed = await prisma.giftRequest.findUnique({
      where: { userId },
    });
    if (claimed)
      return NextResponse.json({ error: "כבר בחרת מתנה" }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
