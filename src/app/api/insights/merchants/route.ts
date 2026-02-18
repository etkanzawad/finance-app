import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { NextRequest, NextResponse } from "next/server";

const SKIP_CATEGORIES = new Set(["Transfers", "Income", "Cash Withdrawal", "Fees"]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  const allTxns = await db.select().from(transactions);

  const filtered = allTxns.filter(
    (tx) =>
      tx.amount < 0 &&
      !tx.isIncome &&
      !SKIP_CATEGORIES.has(tx.category || "") &&
      (!month || tx.statementMonth === month)
  );

  const grouped: Record<string, { total: number; count: number; lastDate: string; category: string }> = {};

  for (const tx of filtered) {
    const key = tx.cleanDescription || tx.rawDescription;
    if (!grouped[key]) {
      grouped[key] = { total: 0, count: 0, lastDate: tx.date, category: tx.category || "Other" };
    }
    grouped[key].total += Math.abs(tx.amount);
    grouped[key].count++;
    if (tx.date > grouped[key].lastDate) {
      grouped[key].lastDate = tx.date;
    }
  }

  const result = Object.entries(grouped)
    .map(([merchant, data]) => ({
      merchant,
      category: data.category,
      visitCount: data.count,
      totalSpent: data.total,
      avgPerVisit: Math.round(data.total / data.count),
      lastDate: data.lastDate,
    }))
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 50);

  return NextResponse.json(result);
}
