import { NextResponse } from "next/server";
import { getGiftsWithRemaining } from "@/lib/monday";
import { checkRateLimit } from "@/lib/rate-limit";

// Stock changes at runtime — never serve a build-time snapshot.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const limited = checkRateLimit(request, "gifts", {
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const gifts = await getGiftsWithRemaining();
    return NextResponse.json({ gifts });
  } catch {
    // Fallback to empty list if Monday is misconfigured, avoiding server error.
    return NextResponse.json({ gifts: [] }, { status: 200 });
  }
}
