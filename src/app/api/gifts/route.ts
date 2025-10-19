import { NextResponse } from "next/server";
import { getGiftsWithRemaining } from "@/lib/monday";

// Run this route on the Edge Runtime for faster cold starts
export const runtime = "edge";
// Keep execution in EU (Frankfurt) to reduce cross-region latency
export const preferredRegion = ["fra1"];

export async function GET() {
  try {
    const gifts = await getGiftsWithRemaining();
    return NextResponse.json({ gifts });
  } catch {
    // Fallback to empty list if Monday is misconfigured, avoiding server error.
    return NextResponse.json({ gifts: [] }, { status: 200 });
  }
}
