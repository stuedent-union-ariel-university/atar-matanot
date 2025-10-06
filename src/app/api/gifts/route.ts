import { NextResponse } from "next/server";
import { getGiftsWithRemaining } from "@/lib/monday";

export async function GET() {
  try {
    const gifts = await getGiftsWithRemaining();
    return NextResponse.json({ gifts });
  } catch (e) {
    // Fallback to empty list if Monday is misconfigured, avoiding server error.
    return NextResponse.json({ gifts: [] }, { status: 200 });
  }
}
