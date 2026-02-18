import { db } from "@/lib/db";
import { transactions, bnplPlans, bnplAccounts } from "@/lib/db/schema";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { generateMonthlyReport } from "@/lib/gemini";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // "2025-01" format

  if (!month) {
    return NextResponse.json(
      { error: "month query parameter required (YYYY-MM)" },
      { status: 400 }
    );
  }

  // Parse month range
  const [year, mon] = month.split("-").map(Number);
  const startDate = `${month}-01`;
  const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;
  const endDate = `${nextMonth}-01`;

  // Previous month for comparison
  const prevYear = mon === 1 ? year - 1 : year;
  const prevMon = mon === 1 ? 12 : mon - 1;
  const prevMonth = `${prevYear}-${String(prevMon).padStart(2, "0")}`;
  const prevStartDate = `${prevMonth}-01`;

  // Get transactions for this month
  const monthTxns = await db
    .select()
    .from(transactions)
    .where(and(gte(transactions.date, startDate), lt(transactions.date, endDate)));

  // Get transactions for previous month
  const prevMonthTxns = await db
    .select()
    .from(transactions)
    .where(and(gte(transactions.date, prevStartDate), lt(transactions.date, startDate)));

  // Calculate category totals
  const categoryTotals: Record<string, number> = {};
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const txn of monthTxns) {
    if (txn.isIncome || txn.amount > 0) {
      totalIncome += Math.abs(txn.amount);
    } else {
      totalExpenses += Math.abs(txn.amount);
      const cat = txn.category || "Uncategorised";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(txn.amount);
    }
  }

  // Previous month totals
  const previousMonthTotals: Record<string, number> = {};
  for (const txn of prevMonthTxns) {
    if (!txn.isIncome && txn.amount < 0) {
      const cat = txn.category || "Uncategorised";
      previousMonthTotals[cat] = (previousMonthTotals[cat] || 0) + Math.abs(txn.amount);
    }
  }

  // BNPL exposure
  const plans = await db
    .select({
      instalmentAmount: bnplPlans.instalmentAmount,
      instalmentsRemaining: bnplPlans.instalmentsRemaining,
    })
    .from(bnplPlans)
    .innerJoin(bnplAccounts, eq(bnplPlans.bnplAccountId, bnplAccounts.id));

  const bnplExposure = plans.reduce(
    (sum, p) => sum + p.instalmentAmount * p.instalmentsRemaining,
    0
  );

  // Detect anomalies
  const anomalies: string[] = [];
  for (const [cat, amount] of Object.entries(categoryTotals)) {
    const prev = previousMonthTotals[cat] || 0;
    if (prev > 0 && amount > prev * 1.5) {
      anomalies.push(
        `${cat} spending increased ${Math.round(((amount - prev) / prev) * 100)}% from last month`
      );
    }
  }

  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // If no transactions, return raw data without AI
  if (monthTxns.length === 0) {
    return NextResponse.json({
      month,
      totalIncome,
      totalExpenses,
      savingsRate,
      categoryTotals,
      bnplExposure,
      report: null,
      message: "No transactions found for this month",
    });
  }

  try {
    const report = await generateMonthlyReport({
      month,
      categoryTotals,
      previousMonthTotals,
      totalIncome,
      totalExpenses,
      savingsRate,
      bnplExposure,
      previousBnplExposure: 0,
      anomalies,
    });

    return NextResponse.json({
      month,
      totalIncome,
      totalExpenses,
      savingsRate,
      categoryTotals,
      bnplExposure,
      report,
    });
  } catch {
    // Return raw data if AI fails
    return NextResponse.json({
      month,
      totalIncome,
      totalExpenses,
      savingsRate,
      categoryTotals,
      bnplExposure,
      report: null,
      message: "AI report generation unavailable",
    });
  }
}
