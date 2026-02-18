import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { desc, eq, gte, and, lt, sql, or } from "drizzle-orm";
import { calculateSafeToSpend } from "@/lib/cashflow";
import { processIncome } from "@/lib/process-income";
import { format, addDays, startOfMonth } from "date-fns";

export async function GET() {
  try {
    // Process any due income payments before loading dashboard data
    await processIncome();

    const today = format(new Date(), "yyyy-MM-dd");
    const in14Days = format(addDays(new Date(), 14), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

    // Fetch all needed data in parallel
    const [
      incomes,
      bankAccounts,
      creditCards,
      bnplPlans,
      fixedExpenses,
      recentTransactions,
      monthlySpending,
      wishlistItemsData,
    ] = await Promise.all([
      db.select().from(schema.income),
      db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.type, "bank")),
      db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.type, "credit_card")),
      db
        .select({
          id: schema.bnplPlans.id,
          itemName: schema.bnplPlans.itemName,
          instalmentAmount: schema.bnplPlans.instalmentAmount,
          instalmentFrequency: schema.bnplPlans.instalmentFrequency,
          instalmentsRemaining: schema.bnplPlans.instalmentsRemaining,
          nextPaymentDate: schema.bnplPlans.nextPaymentDate,
          provider: schema.bnplAccounts.provider,
        })
        .from(schema.bnplPlans)
        .innerJoin(
          schema.bnplAccounts,
          eq(schema.bnplPlans.bnplAccountId, schema.bnplAccounts.id)
        )
        .where(
          and(
            eq(schema.bnplAccounts.isActive, true),
            sql`${schema.bnplPlans.instalmentsRemaining} > 0`
          )
        ),
      db
        .select()
        .from(schema.fixedExpenses)
        .where(eq(schema.fixedExpenses.isActive, true)),
      db
        .select()
        .from(schema.transactions)
        .orderBy(desc(schema.transactions.date), desc(schema.transactions.id))
        .limit(10),
      db
        .select({
          category: schema.transactions.category,
          total: sql<number>`SUM(ABS(${schema.transactions.amount}))`,
        })
        .from(schema.transactions)
        .where(
          and(
            gte(schema.transactions.date, monthStart),
            lt(schema.transactions.amount, 0),
            eq(schema.transactions.isIncome, false)
          )
        )
        .groupBy(schema.transactions.category),
      db
        .select()
        .from(schema.wishlistItems)
        .where(
          or(
            eq(schema.wishlistItems.status, "wanted"),
            eq(schema.wishlistItems.status, "saving")
          )
        )
        .orderBy(schema.wishlistItems.priority)
        .limit(5),
    ]);

    // Calculate total bank balance
    const totalBankBalance = bankAccounts.reduce(
      (sum, a) => sum + a.balance,
      0
    );

    // Split bank accounts: "current" accounts are earmarked for bills/expenses,
    // savings/other accounts are what's available to spend
    const currentAccountNames = ["current"];
    const isCurrentAccount = (name: string) =>
      currentAccountNames.some((kw) => name.toLowerCase().includes(kw));

    const expenseAccountBalance = bankAccounts
      .filter((a) => isCurrentAccount(a.name))
      .reduce((sum, a) => sum + a.balance, 0);
    const availableBalance = bankAccounts
      .filter((a) => !isCurrentAccount(a.name))
      .reduce((sum, a) => sum + a.balance, 0);

    // Calculate net position: bank balances minus credit card balances minus BNPL outstanding
    const totalCreditCardDebt = creditCards.reduce(
      (sum, a) => sum + a.balance,
      0
    );
    const totalBnplDebt = bnplPlans.reduce(
      (sum, p) => sum + p.instalmentAmount * p.instalmentsRemaining,
      0
    );
    const netPosition = totalBankBalance - totalCreditCardDebt - totalBnplDebt;

    // Safe to Spend calculation - uses available (non-current) accounts only
    // Fixed expenses and subscriptions come out of the Current account,
    // so they are NOT deducted from the available balance
    const safeToSpendResult = calculateSafeToSpend({
      currentBalance: availableBalance,
      incomes: incomes.map((i) => ({
        name: i.name,
        amount: i.amount,
        frequency: i.frequency,
        nextPayDate: i.nextPayDate,
      })),
      expenses: [],
      bnplPayments: bnplPlans.map((p) => ({
        itemName: p.itemName,
        provider: p.provider,
        instalmentAmount: p.instalmentAmount,
        instalmentFrequency: p.instalmentFrequency,
        instalmentsRemaining: p.instalmentsRemaining,
        nextPaymentDate: p.nextPaymentDate,
      })),
      creditCards: [],
    });

    // Upcoming payments in next 14 days (from the safeToSpend result, filter to 14 days)
    const upcomingPayments = safeToSpendResult.upcomingExpenses.filter(
      (e) => e.date <= in14Days
    );

    // Also add expenses beyond the pay cycle but within 14 days
    // Gather all upcoming from fixed expenses, BNPL, credit cards within 14 days
    const allUpcoming: { name: string; amount: number; date: string; type: string }[] = [];

    for (const exp of fixedExpenses) {
      // Simple check: if nextDueDate is within 14 days
      if (exp.nextDueDate >= today && exp.nextDueDate <= in14Days) {
        allUpcoming.push({
          name: exp.name,
          amount: exp.amount,
          date: exp.nextDueDate,
          type: "expense",
        });
      }
    }

    for (const plan of bnplPlans) {
      if (
        plan.nextPaymentDate >= today &&
        plan.nextPaymentDate <= in14Days &&
        plan.instalmentsRemaining > 0
      ) {
        allUpcoming.push({
          name: `${plan.provider} - ${plan.itemName}`,
          amount: plan.instalmentAmount,
          date: plan.nextPaymentDate,
          type: "bnpl",
        });
      }
    }

    for (const cc of creditCards) {
      if (cc.dueDate && cc.balance > 0) {
        const now = new Date();
        let dueDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          cc.dueDate
        );
        if (dueDate < now) {
          dueDate = new Date(now.getFullYear(), now.getMonth() + 1, cc.dueDate);
        }
        const dueDateStr = format(dueDate, "yyyy-MM-dd");
        if (dueDateStr >= today && dueDateStr <= in14Days) {
          allUpcoming.push({
            name: `${cc.name} payment`,
            amount: Math.max(2500, Math.round(cc.balance * 0.02)),
            date: dueDateStr,
            type: "credit_card",
          });
        }
      }
    }

    allUpcoming.sort((a, b) => a.date.localeCompare(b.date));

    // Spending by category this month
    const spendingByCategory = monthlySpending.map((s) => ({
      category: s.category || "Uncategorised",
      amount: Number(s.total),
    }));

    // Accounts summary
    const accountsSummary = {
      bankAccounts: bankAccounts.map((a) => ({
        name: a.name,
        balance: a.balance,
      })),
      creditCards: creditCards.map((cc) => ({
        name: cc.name,
        balance: cc.balance,
        limit: cc.creditLimit,
      })),
    };

    const wishlistSummary = {
      topItems: wishlistItemsData.slice(0, 3).map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        priority: i.priority,
        status: i.status,
      })),
      totalValue: wishlistItemsData.reduce((sum, i) => sum + i.price, 0),
      itemCount: wishlistItemsData.length,
    };

    return NextResponse.json({
      safeToSpend: safeToSpendResult,
      netPosition,
      totalBankBalance,
      availableBalance,
      expenseAccountBalance,
      totalCreditCardDebt,
      totalBnplDebt,
      upcomingPayments: allUpcoming,
      spendingByCategory,
      recentTransactions,
      accountsSummary,
      wishlistSummary,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
