import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { pin } = await req.json();

  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "profile"));

  if (rows.length === 0) {
    return NextResponse.json({ valid: true }); // No profile = no pin required
  }

  const profile = JSON.parse(rows[0].value);

  if (!profile.pin) {
    return NextResponse.json({ valid: true }); // No pin set
  }

  return NextResponse.json({ valid: pin === profile.pin });
}
