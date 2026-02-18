import { db } from "@/lib/db";
import { wishlistItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {
    name: body.name,
    price: body.price,
    url: body.url ?? null,
    store: body.store ?? null,
    priority: body.priority,
    notes: body.notes ?? null,
    category: body.category ?? null,
  };

  if (body.status) {
    updates.status = body.status;
    if (body.status === "purchased") {
      updates.datePurchased = format(new Date(), "yyyy-MM-dd");
    }
  }

  if (body.linkedGoalId !== undefined) {
    updates.linkedGoalId = body.linkedGoalId;
  }

  const result = await db
    .update(wishlistItems)
    .set(updates)
    .where(eq(wishlistItems.id, Number(id)))
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(result[0]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(wishlistItems).where(eq(wishlistItems.id, Number(id)));
  return NextResponse.json({ success: true });
}
