import { NextResponse } from "next/server";
import { isSubmissionClosed } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
    checksumEnforced,
    hasValidCheckDigit,
    normalizeUserId,
} from "@/lib/id";
import {
    SESSION_COOKIE,
    createSessionToken,
    sessionCookieOptions,
} from "@/lib/session";

// Verify user ID by checking it appears in the Users table,
// and has NOT appeared yet in the GiftRequest table.
// On success, sets a signed session cookie so later requests don't need the ID.
// The ID is sent in the JSON body, never in the URL.
export async function POST(request: Request) {
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

        const body = await request.json().catch(() => null);
        const userId = normalizeUserId(body?.userId);
        if (!userId) {
            return NextResponse.json(
                { error: "נא להזין מספר זהות חוקי (7-10 ספרות)" },
                { status: 400 },
            );
        }
        if (checksumEnforced() && !hasValidCheckDigit(userId)) {
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
            const user = await prisma.user.findUnique({
                where: { id: userId },
            });
            isEligible = Boolean(user);
            console.info("[verify-id] user check", { result: isEligible });
        } catch (err) {
            console.error("[verify-id] user check failed", err);
            throw err;
        }

        let alreadyClaimed = false;
        try {
            const giftRequest = await prisma.giftRequest.findUnique({
                where: { userId },
            });
            alreadyClaimed = Boolean(giftRequest);
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
            return NextResponse.json(
                { error: "כבר בחרת מתנה" },
                { status: 400 },
            );
        }

        const response = NextResponse.json({ success: true });
        response.cookies.set(
            SESSION_COOKIE,
            createSessionToken(userId),
            sessionCookieOptions,
        );
        return response;
    } catch (e) {
        console.error("[verify-id] unhandled error", e);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
