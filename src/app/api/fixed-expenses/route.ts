import { db } from "@/lib/db";
import { fixedExpenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const rows = await db.select().from(fixedExpenses).orderBy(fixedExpenses.name);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await db.insert(fixedExpenses).values({
    name: body.name,
    amount: body.amount,
    frequency: body.frequency,
    nextDueDate: body.nextDueDate,
    category: body.category ?? null,
    isActive: body.isActive ?? true,
  }).returning();
  return NextResponse.json(result[0], { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const result = await db.update(fixedExpenses).set({
    name: body.name,
    amount: body.amount,
    frequency: body.frequency,
    nextDueDate: body.nextDueDate,
    category: body.category ?? null,
    isActive: body.isActive,
  }).where(eq(fixedExpenses.id, body.id)).returning();
  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(result[0]);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await db.delete(fixedExpenses).where(eq(fixedExpenses.id, id));
  return NextResponse.json({ success: true });
}
