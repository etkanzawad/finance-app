import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

// GET — get single conversation with full messages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, Number(id)));

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...row,
    messages: JSON.parse(row.messages),
  });
}

// PUT — update conversation (title, messages)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = { updatedAt: sql`now()` };
  if (body.title !== undefined) updates.title = body.title;
  if (body.messages !== undefined) {
    updates.messages = typeof body.messages === "string" ? body.messages : JSON.stringify(body.messages);
  }

  const [row] = await db
    .update(schema.conversations)
    .set(updates)
    .where(eq(schema.conversations.id, Number(id)))
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(row);
}

// DELETE — delete a conversation
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db
    .delete(schema.conversations)
    .where(eq(schema.conversations.id, Number(id)));

  return NextResponse.json({ success: true });
}
