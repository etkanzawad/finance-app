import { db } from "@/lib/db";
import { savingsGoals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const result = await db
    .update(savingsGoals)
    .set({
      name: body.name,
      targetAmount: body.targetAmount,
      currentAmount: body.currentAmount,
      deadline: body.deadline ?? null,
      priority: body.priority,
    })
    .where(eq(savingsGoals.id, Number(id)))
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
  await db.delete(savingsGoals).where(eq(savingsGoals.id, Number(id)));
  return NextResponse.json({ success: true });
}
