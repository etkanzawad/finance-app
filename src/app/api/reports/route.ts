import { createClient } from "@/lib/supabase/server";
import { generateMonthlyReport } from "@/lib/gemini";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

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
  const { data: monthTxns, error: monthError } = await supabase
    .from("transactions")
    .select("*")
    .gte("date", startDate)
    .lt("date", endDate);

  if (monthError) throw monthError;

  // Get transactions for previous month
  const { data: prevMonthTxns, error: prevError } = await supabase
    .from("transactions")
    .select("*")
    .gte("date", prevStartDate)
    .lt("date", startDate);

  if (prevError) throw prevError;

  // Calculate category totals
  const categoryTotals: Record<string, number> = {};
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const txn of monthTxns) {
    if (txn.is_income || txn.amount > 0) {
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
    if (!txn.is_income && txn.amount < 0) {
      const cat = txn.category || "Uncategorised";
      previousMonthTotals[cat] = (previousMonthTotals[cat] || 0) + Math.abs(txn.amount);
    }
  }

  // BNPL exposure
  const { data: plans, error: bnplError } = await supabase
    .from("bnpl_plans")
    .select("instalment_amount, instalments_remaining, bnpl_accounts!inner(*)")

  if (bnplError) throw bnplError;

  const bnplExposure = plans.reduce(
    (sum: number, p: any) => sum + p.instalment_amount * p.instalments_remaining,
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
