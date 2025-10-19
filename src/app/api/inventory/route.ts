import { NextResponse } from "next/server";
import { getInventoryMap } from "@/lib/monday";

export const runtime = "edge";
export const preferredRegion = ["fra1"];

export async function GET() {
  try {
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
