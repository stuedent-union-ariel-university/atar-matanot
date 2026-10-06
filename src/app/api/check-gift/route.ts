import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSessionUserId } from "@/lib/session";

// Reports whether the signed-in user may still choose a gift.
// The user ID comes from the session cookie, not from the URL.
export async function GET(request: Request) {
    try {
        const limited = checkRateLimit(request, "check-gift", {
            limit: 20,
            windowMs: 60_000,
        });
        if (limited) return limited;

        const userId = await getSessionUserId();
        if (!userId)
            return NextResponse.json(
                { error: "נדרש אימות מחדש" },
                { status: 401 },
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
            return NextResponse.json(
                { error: "כבר בחרת מתנה" },
                { status: 400 },
            );

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
