import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { desc, sql } from "drizzle-orm";

// GET — list all conversations (id, title, updatedAt), ordered by updatedAt desc
export async function GET() {
  const rows = await db
    .select({
      id: schema.conversations.id,
      title: schema.conversations.title,
      updatedAt: schema.conversations.updatedAt,
      messages: schema.conversations.messages,
    })
    .from(schema.conversations)
    .orderBy(desc(schema.conversations.updatedAt));

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
      updatedAt: row.updatedAt,
      lastMessage,
    };
  });

  return NextResponse.json(result);
}

// POST — create a new conversation { title, messages } → returns the new row
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, messages } = body;

  if (!title || !messages) {
    return NextResponse.json({ error: "title and messages are required" }, { status: 400 });
  }

  const [row] = await db
    .insert(schema.conversations)
    .values({
      title,
      messages: typeof messages === "string" ? messages : JSON.stringify(messages),
      updatedAt: sql`now()`,
    })
    .returning();

  return NextResponse.json(row);
}
