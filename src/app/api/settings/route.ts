import { db } from "@/lib/db";
import { settings, income, accounts, bnplAccounts, bnplPlans, fixedExpenses, transactions, savingsGoals, merchantMappings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const rows = await db.select().from(settings);
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return NextResponse.json(result);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { key, value } = body;

  const existing = await db.select().from(settings).where(eq(settings.key, key));
  if (existing.length > 0) {
    await db.update(settings).set({ value }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value });
  }
  return NextResponse.json({ success: true });
}
