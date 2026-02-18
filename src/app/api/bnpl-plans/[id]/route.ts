import { db } from "@/lib/db";
import { bnplPlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const result = await db
    .update(bnplPlans)
    .set({
      itemName: body.itemName,
      totalAmount: body.totalAmount,
      instalmentAmount: body.instalmentAmount,
      instalmentFrequency: body.instalmentFrequency,
      instalmentsTotal: body.instalmentsTotal,
      instalmentsRemaining: body.instalmentsRemaining,
      nextPaymentDate: body.nextPaymentDate,
    })
    .where(eq(bnplPlans.id, Number(id)))
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
  await db.delete(bnplPlans).where(eq(bnplPlans.id, Number(id)));
  return NextResponse.json({ success: true });
}
