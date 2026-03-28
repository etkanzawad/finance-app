import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { toCamel } from "@/lib/db/camel";

// GET -- list all conversations (id, title, updated_at), ordered by updated_at desc
export async function GET() {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from('conversations')
    .select('id, title, updated_at, messages')
    .order('updated_at', { ascending: false });
  if (error) throw error;

  // Include a preview of the last message
  const result = rows.map((row) => {
    let lastMessage = "";
    try {
      const msgs = JSON.parse(row.messages);
      if (msgs.length > 0) {
        lastMessage = msgs[msgs.length - 1].content?.slice(0, 100) || "";
      }
    } catch {}
    return {
      id: row.id,
      title: row.title,
      updatedAt: row.updated_at,
      lastMessage,
    };
  });

  return NextResponse.json(result);
}

// POST -- create a new conversation { title, messages } -> returns the new row
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { title, messages } = body;

  if (!title || !messages) {
    return NextResponse.json({ error: "title and messages are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      title,
      messages: typeof messages === "string" ? messages : JSON.stringify(messages),
      updated_at: new Date().toISOString(),
    })
    .select();
  if (error) throw error;

  return NextResponse.json(toCamel(data[0]));
}
