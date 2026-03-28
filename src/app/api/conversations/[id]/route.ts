import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { toCamel } from "@/lib/db/camel";

// GET -- get single conversation with full messages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', Number(id));
  if (error) throw error;

  const row = data[0];
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(toCamel({
    ...row,
    messages: JSON.parse(row.messages),
  }));
}

// PUT -- update conversation (title, messages)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.messages !== undefined) {
    updates.messages = typeof body.messages === "string" ? body.messages : JSON.stringify(body.messages);
  }

  const { data, error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', Number(id))
    .select();
  if (error) throw error;

  const row = data[0];
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(toCamel(row));
}

// DELETE -- delete a conversation
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', Number(id));
  if (error) throw error;

  return NextResponse.json({ success: true });
}
