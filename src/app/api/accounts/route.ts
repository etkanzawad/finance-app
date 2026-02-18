import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const rows = await db.select().from(accounts).orderBy(accounts.name);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await db.insert(accounts).values({
    name: body.name,
    type: body.type,
    balance: body.balance,
    creditLimit: body.creditLimit ?? null,
    interestRate: body.interestRate ?? null,
    statementDate: body.statementDate ?? null,
    dueDate: body.dueDate ?? null,
  }).returning();
  return NextResponse.json(result[0], { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const result = await db.update(accounts).set({
    name: body.name,
    type: body.type,
    balance: body.balance,
    creditLimit: body.creditLimit ?? null,
    interestRate: body.interestRate ?? null,
    statementDate: body.statementDate ?? null,
    dueDate: body.dueDate ?? null,
  }).where(eq(accounts.id, body.id)).returning();
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
  await db.delete(accounts).where(eq(accounts.id, id));
  return NextResponse.json({ success: true });
}
