import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCamel } from "@/lib/db/camel";
import { calculateSafeToSpend } from "@/lib/cashflow";
import { processIncome } from "@/lib/process-income";
import { format, addDays, startOfMonth } from "date-fns";

export async function GET() {
  try {
    // Process any due income payments before loading dashboard data
    await processIncome();

    const supabase = await createClient();

    const today = format(new Date(), "yyyy-MM-dd");
    const in14Days = format(addDays(new Date(), 14), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

    // Fetch all needed data in parallel
    const [
      incomesRes,
      bankAccountsRes,
      creditCardsRes,
      bnplPlansRes,
      fixedExpensesRes,
      recentTransactionsRes,
      monthlySpendingRes,
      wishlistItemsRes,
    ] = await Promise.all([
      supabase.from("income").select("*"),
      supabase.from("accounts").select("*").eq("type", "bank"),
      supabase.from("accounts").select("*").eq("type", "credit_card"),
      supabase
        .from("bnpl_plans")
        .select("*, bnpl_accounts!inner(*)")
        .gt("instalments_remaining", 0)
        .eq("bnpl_accounts.is_active", true),
      supabase
        .from("fixed_expenses")
        .select("*")
        .eq("is_active", true),
      supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .order("id", { ascending: false })
        .limit(10),
      supabase.rpc("monthly_spending_by_category", {
        start_date: monthStart,
      }),
      supabase
        .from("wishlist_items")
        .select("*")
        .in("status", ["wanted", "saving"])
        .order("priority", { ascending: true })
        .limit(5),
    ]);

    // Check for errors
    if (incomesRes.error) throw incomesRes.error;
    if (bankAccountsRes.error) throw bankAccountsRes.error;
    if (creditCardsRes.error) throw creditCardsRes.error;
    if (bnplPlansRes.error) throw bnplPlansRes.error;
    if (fixedExpensesRes.error) throw fixedExpensesRes.error;
    if (recentTransactionsRes.error) throw recentTransactionsRes.error;
    if (monthlySpendingRes.error) throw monthlySpendingRes.error;
    if (wishlistItemsRes.error) throw wishlistItemsRes.error;

    const incomes = incomesRes.data;
    const bankAccounts = bankAccountsRes.data;
    const creditCards = creditCardsRes.data;
    const bnplPlansRaw = bnplPlansRes.data;
    const fixedExpenses = fixedExpensesRes.data;
    const recentTransactions = recentTransactionsRes.data;
    const monthlySpending = monthlySpendingRes.data;
    const wishlistItemsData = wishlistItemsRes.data;

    // Flatten bnpl_plans join result to camelCase
    const bnplPlans = bnplPlansRaw.map((p: any) => ({
      id: p.id,
      itemName: p.item_name,
      instalmentAmount: p.instalment_amount,
      instalmentFrequency: p.instalment_frequency,
      instalmentsRemaining: p.instalments_remaining,
      nextPaymentDate: p.next_payment_date,
      provider: p.bnpl_accounts.provider,
    }));

    // Calculate total bank balance
    const totalBankBalance = bankAccounts.reduce(
      (sum: number, a: any) => sum + a.balance,
      0
    );

    // Split bank accounts: "current" accounts are earmarked for bills/expenses,
    // savings/other accounts are what's available to spend
    const currentAccountNames = ["current"];
    const isCurrentAccount = (name: string) =>
      currentAccountNames.some((kw) => name.toLowerCase().includes(kw));

    const expenseAccountBalance = bankAccounts
      .filter((a: any) => isCurrentAccount(a.name))
      .reduce((sum: number, a: any) => sum + a.balance, 0);
    const availableBalance = bankAccounts
      .filter((a: any) => !isCurrentAccount(a.name))
      .reduce((sum: number, a: any) => sum + a.balance, 0);

    // Calculate net position: bank balances minus credit card balances minus BNPL outstanding
    const totalCreditCardDebt = creditCards.reduce(
      (sum: number, a: any) => sum + a.balance,
      0
    );
    const totalBnplDebt = bnplPlans.reduce(
      (sum: number, p: any) => sum + p.instalmentAmount * p.instalmentsRemaining,
      0
    );
    const netPosition = totalBankBalance - totalCreditCardDebt - totalBnplDebt;

    // Safe to Spend calculation - uses available (non-current) accounts only
    // Fixed expenses and subscriptions come out of the Current account,
    // so they are NOT deducted from the available balance
    const safeToSpendResult = calculateSafeToSpend({
      currentBalance: availableBalance,
      incomes: incomes.map((i: any) => ({
        name: i.name,
        amount: i.amount,
        frequency: i.frequency,
        nextPayDate: i.next_pay_date,
      })),
      expenses: [],
      bnplPayments: bnplPlans.map((p: any) => ({
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
      (e: any) => e.date <= in14Days
    );

    // Also add expenses beyond the pay cycle but within 14 days
    // Gather all upcoming from fixed expenses, BNPL, credit cards within 14 days
    const allUpcoming: { name: string; amount: number; date: string; type: string }[] = [];

    for (const exp of fixedExpenses) {
      // Simple check: if nextDueDate is within 14 days
      if (exp.next_due_date >= today && exp.next_due_date <= in14Days) {
        allUpcoming.push({
          name: exp.name,
          amount: exp.amount,
          date: exp.next_due_date,
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
      if (cc.due_date && cc.balance > 0) {
        const now = new Date();
        let dueDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          cc.due_date
        );
        if (dueDate < now) {
          dueDate = new Date(now.getFullYear(), now.getMonth() + 1, cc.due_date);
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
    const spendingByCategory = monthlySpending.map((s: any) => ({
      category: s.category || "Uncategorised",
      amount: Number(s.total),
    }));

    // Accounts summary
    const accountsSummary = {
      bankAccounts: bankAccounts.map((a: any) => ({
        name: a.name,
        balance: a.balance,
      })),
      creditCards: creditCards.map((cc: any) => ({
        name: cc.name,
        balance: cc.balance,
        limit: cc.credit_limit,
      })),
    };

    const wishlistSummary = {
      topItems: wishlistItemsData.slice(0, 3).map((i: any) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        priority: i.priority,
        status: i.status,
      })),
      totalValue: wishlistItemsData.reduce((sum: number, i: any) => sum + i.price, 0),
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
      recentTransactions: toCamel(recentTransactions),
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
