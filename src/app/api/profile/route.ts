import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// GET profile settings (name)
export async function GET() {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "profile"));

  if (rows.length === 0) {
    return NextResponse.json({ name: "" });
  }

  const profile = JSON.parse(rows[0].value);
  return NextResponse.json({
    name: profile.name || "",
  });
}

// PUT update profile (name)
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { name } = body;

  // Get existing profile
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "profile"));

  const existing = rows.length > 0 ? JSON.parse(rows[0].value) : {};

  const updated = { ...existing };

  if (name !== undefined) {
    updated.name = name;
  }

  // Remove legacy PIN data if present
  delete updated.pin;

  if (rows.length === 0) {
    await db.insert(settings).values({ key: "profile", value: JSON.stringify(updated) });
  } else {
    await db.update(settings).set({ value: JSON.stringify(updated) }).where(eq(settings.key, "profile"));
  }

  return NextResponse.json({ success: true, name: updated.name || "" });
}
