import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase.from('settings').select('*');
  if (error) throw error;

  const result: Record<string, string> = {};
  for (const row of data) {
    result[row.key] = row.value;
  }
  return NextResponse.json(result);
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { key, value } = body;

  const { error } = await supabase
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;

  return NextResponse.json({ success: true });
}
