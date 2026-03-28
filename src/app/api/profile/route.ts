import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET profile settings (name)
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('key', 'profile');
  if (error) throw error;

  if (data.length === 0) {
    return NextResponse.json({ name: "" });
  }

  const profile = JSON.parse(data[0].value);
  return NextResponse.json({
    name: profile.name || "",
  });
}

// PUT update profile (name)
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { name } = body;

  // Get existing profile
  const { data: rows, error: fetchError } = await supabase
    .from('settings')
    .select('*')
    .eq('key', 'profile');
  if (fetchError) throw fetchError;

  const existing = rows.length > 0 ? JSON.parse(rows[0].value) : {};

  const updated = { ...existing };

  if (name !== undefined) {
    updated.name = name;
  }

  // Remove legacy PIN data if present
  delete updated.pin;

  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'profile', value: JSON.stringify(updated) }, { onConflict: 'key' });
  if (error) throw error;

  return NextResponse.json({ success: true, name: updated.name || "" });
}
