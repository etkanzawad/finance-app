import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// GET profile settings (name, pin_hash)
export async function GET() {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "profile"));

  if (rows.length === 0) {
    return NextResponse.json({ name: "", hasPin: false });
  }

  const profile = JSON.parse(rows[0].value);
  return NextResponse.json({
    name: profile.name || "",
    hasPin: !!profile.pin,
  });
}

// PUT update profile (name, pin)
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { name, pin, currentPin, action } = body;

  // Get existing profile
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "profile"));

  const existing = rows.length > 0 ? JSON.parse(rows[0].value) : {};

  // If changing/removing PIN and one exists, verify current PIN
  if (existing.pin && (action === "change_pin" || action === "remove_pin")) {
    if (currentPin !== existing.pin) {
      return NextResponse.json({ error: "Incorrect current PIN" }, { status: 401 });
    }
  }

  let updated = { ...existing };

  if (action === "remove_pin") {
    delete updated.pin;
  } else if (action === "change_pin" || action === "set_pin") {
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be 4 digits" }, { status: 400 });
    }
    updated.pin = pin;
  }

  if (name !== undefined) {
    updated.name = name;
  }

  if (rows.length === 0) {
    await db.insert(settings).values({ key: "profile", value: JSON.stringify(updated) });
  } else {
    await db.update(settings).set({ value: JSON.stringify(updated) }).where(eq(settings.key, "profile"));
  }

  return NextResponse.json({ success: true, name: updated.name || "", hasPin: !!updated.pin });
}
