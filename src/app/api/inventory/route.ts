import { NextResponse } from "next/server";
import { getInventoryMap } from "@/lib/monday";
import { checkRateLimit } from "@/lib/rate-limit";

// Stock changes at runtime — never serve a build-time snapshot.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const limited = checkRateLimit(request, "inventory", {
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const map = await getInventoryMap();
    const list = Array.from(map.entries()).map(([giftId, stock]) => ({
      giftId,
      stock,
    }));
    return NextResponse.json({ inventory: list });
  } catch {
    return NextResponse.json(
      { error: "Inventory not configured" },
      { status: 500 }
    );
  }
}
