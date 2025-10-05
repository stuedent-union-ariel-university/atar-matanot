import { NextResponse } from "next/server";
import { gifts } from "@/lib/gifts";

export async function GET() {
  // In future we could filter by availability or user eligibility.
  return NextResponse.json({ gifts });
}
