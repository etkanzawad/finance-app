import { db } from "@/lib/db";
import { income } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const rows = await db.select().from(income).orderBy(income.name);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await db.insert(income).values({
    name: body.name,
    amount: body.amount,
    frequency: body.frequency,
    nextPayDate: body.nextPayDate,
    accountId: body.accountId || null,
  }).returning();
  return NextResponse.json(result[0], { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const result = await db.update(income).set({
    name: body.name,
    amount: body.amount,
    frequency: body.frequency,
    nextPayDate: body.nextPayDate,
    accountId: body.accountId ?? undefined,
  }).where(eq(income.id, body.id)).returning();
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
  await db.delete(income).where(eq(income.id, id));
  return NextResponse.json({ success: true });
}
