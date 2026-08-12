import { NextResponse } from "next/server";
import { getGiftsWithRemaining } from "@/lib/monday";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

// Stock changes at runtime — never serve a build-time snapshot.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const limited = checkRateLimit(request, "gifts", {
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const catalog = await prisma.gift.findMany();
    const gifts = await getGiftsWithRemaining(
      catalog.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description ?? undefined,
        image: g.image ?? undefined,
      })),
    );
    return NextResponse.json({ gifts });
  } catch {
    // Fallback to empty list if Monday is misconfigured, avoiding server error.
    return NextResponse.json({ gifts: [] }, { status: 200 });
  }
}
