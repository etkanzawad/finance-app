import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  const allTxns = await db
    .select()
    .from(transactions)
    .where(eq(transactions.category, "Transfers"));

  const filtered = month ? allTxns.filter((tx) => tx.statementMonth === month) : allTxns;

  const grouped: Record<string, { sent: number; received: number; count: number; lastDate: string }> = {};

  for (const tx of filtered) {
    const key = tx.cleanDescription || tx.rawDescription;
    if (!grouped[key]) {
      grouped[key] = { sent: 0, received: 0, count: 0, lastDate: tx.date };
    }
    grouped[key].count++;
    if (tx.amount < 0) {
      grouped[key].sent += Math.abs(tx.amount);
    } else {
      grouped[key].received += tx.amount;
    }
    if (tx.date > grouped[key].lastDate) {
      grouped[key].lastDate = tx.date;
    }
  }

  const result = Object.entries(grouped)
    .map(([person, data]) => ({
      person,
      sent: data.sent,
      received: data.received,
      net: data.received - data.sent,
      count: data.count,
      lastDate: data.lastDate,
    }))
    .filter((p) => p.sent + p.received > 0)
    .sort((a, b) => b.sent + b.received - (a.sent + a.received));

  return NextResponse.json(result);
}
