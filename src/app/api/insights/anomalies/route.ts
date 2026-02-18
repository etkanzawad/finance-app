import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { and, gte, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  if (!month) {
    return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const startDate = `${month}-01`;
  const nextMon = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;
  const endDate = `${nextMon}-01`;

  const prevYear = mon === 1 ? year - 1 : year;
  const prevMon = mon === 1 ? 12 : mon - 1;
  const prevMonth = `${prevYear}-${String(prevMon).padStart(2, "0")}`;
  const prevStartDate = `${prevMonth}-01`;

  const [currentTxns, prevTxns] = await Promise.all([
    db.select().from(transactions).where(and(gte(transactions.date, startDate), lt(transactions.date, endDate))),
    db.select().from(transactions).where(and(gte(transactions.date, prevStartDate), lt(transactions.date, startDate))),
  ]);

  const currentTotals: Record<string, number> = {};
  const prevTotals: Record<string, number> = {};

  for (const tx of currentTxns) {
    if (!tx.isIncome && tx.amount < 0) {
      const cat = tx.category || "Other";
      currentTotals[cat] = (currentTotals[cat] || 0) + Math.abs(tx.amount);
    }
  }

  for (const tx of prevTxns) {
    if (!tx.isIncome && tx.amount < 0) {
      const cat = tx.category || "Other";
      prevTotals[cat] = (prevTotals[cat] || 0) + Math.abs(tx.amount);
    }
  }

  const allCategories = new Set([...Object.keys(currentTotals), ...Object.keys(prevTotals)]);

  const categories = Array.from(allCategories)
    .map((cat) => {
      const current = currentTotals[cat] || 0;
      const previous = prevTotals[cat] || 0;
      const changePercent =
        previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
      // Flag as anomaly: >=30% change, at least $10 absolute difference, at least $10 current
      const isAnomaly =
        changePercent !== null &&
        Math.abs(changePercent) >= 30 &&
        Math.abs(current - previous) >= 1000 &&
        current >= 1000;
      return {
        category: cat,
        current,
        previous,
        changePercent,
        isAnomaly,
        direction: current >= previous ? "up" : "down",
      };
    })
    .sort((a, b) => {
      if (a.isAnomaly && !b.isAnomaly) return -1;
      if (!a.isAnomaly && b.isAnomaly) return 1;
      return b.current - a.current;
    });

  return NextResponse.json({ month, prevMonth, categories });
}
