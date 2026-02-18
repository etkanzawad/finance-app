import { db } from "@/lib/db";
import { bnplAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const rows = await db.select().from(bnplAccounts).orderBy(bnplAccounts.provider);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await db.insert(bnplAccounts).values({
    provider: body.provider,
    spendingLimit: body.spendingLimit,
    availableLimit: body.availableLimit,
    lateFeeAmount: body.lateFeeAmount ?? null,
    isActive: body.isActive ?? true,
    notes: body.notes ?? null,
  }).returning();
  return NextResponse.json(result[0], { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const result = await db.update(bnplAccounts).set({
    provider: body.provider,
    spendingLimit: body.spendingLimit,
    availableLimit: body.availableLimit,
    lateFeeAmount: body.lateFeeAmount ?? null,
    isActive: body.isActive,
    notes: body.notes ?? null,
  }).where(eq(bnplAccounts.id, body.id)).returning();
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
  await db.delete(bnplAccounts).where(eq(bnplAccounts.id, id));
  return NextResponse.json({ success: true });
}
