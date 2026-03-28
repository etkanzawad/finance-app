import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAffordabilityAdvice } from "@/lib/gemini";
import { calculateSafeToSpend } from "@/lib/cashflow";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { wishlistItemId } = await request.json();

    if (!wishlistItemId) {
      return NextResponse.json(
        { error: "wishlistItemId is required" },
        { status: 400 }
      );
    }

    const [
      itemResult,
      incomesResult,
      bankAccountsResult,
      creditCardsResult,
      bnplAccountsResult,
      bnplPlansResult,
      fixedExpensesResult,
    ] = await Promise.all([
      supabase
        .from("wishlist_items")
        .select("*")
        .eq("id", wishlistItemId),
      supabase.from("income").select("*"),
      supabase.from("accounts").select("*").eq("type", "bank"),
      supabase.from("accounts").select("*").eq("type", "credit_card"),
      supabase.from("bnpl_accounts").select("*").eq("is_active", true),
      supabase
        .from("bnpl_plans")
        .select("*, bnpl_accounts!inner(*)")
        .gt("instalments_remaining", 0)
        .eq("bnpl_accounts.is_active", true),
      supabase.from("fixed_expenses").select("*").eq("is_active", true),
    ]);

    const itemRows = itemResult.data || [];
    const incomes = incomesResult.data || [];
    const bankAccounts = bankAccountsResult.data || [];
    const creditCards = creditCardsResult.data || [];
    const bnplAccountRows = bnplAccountsResult.data || [];
    const bnplPlanRows = bnplPlansResult.data || [];
    const fixedExpenseRows = fixedExpensesResult.data || [];

    const item = itemRows[0];
    if (!item) {
      return NextResponse.json(
        { error: "Wishlist item not found" },
        { status: 404 }
      );
    }

    // Calculate financial snapshot
    const totalBankBalance = bankAccounts.reduce(
      (sum: number, a: any) => sum + a.balance,
      0
    );
    const totalCreditCardDebt = creditCards.reduce(
      (sum: number, a: any) => sum + a.balance,
      0
    );
    const totalBnplDebt = bnplPlanRows.reduce(
      (sum: number, p: any) =>
        sum +
        p.instalment_amount * p.instalments_remaining,
      0
    );
    const totalMonthlyIncome = incomes.reduce((sum: number, i: any) => {
      if (i.frequency === "weekly") return sum + i.amount * 4.33;
      if (i.frequency === "fortnightly") return sum + i.amount * 2.17;
      return sum + i.amount;
    }, 0);
    const totalMonthlyExpenses = fixedExpenseRows.reduce((sum: number, e: any) => {
      if (e.frequency === "weekly") return sum + e.amount * 4.33;
      if (e.frequency === "fortnightly") return sum + e.amount * 2.17;
      if (e.frequency === "quarterly") return sum + e.amount / 3;
      if (e.frequency === "yearly") return sum + e.amount / 12;
      return sum + e.amount;
    }, 0);

    // Calculate safe to spend
    let safeToSpend = 0;
    let daysUntilPay = 0;
    if (incomes.length > 0 && bankAccounts.length > 0) {
      const sts = calculateSafeToSpend({
        currentBalance: totalBankBalance,
        incomes: incomes.map((i: any) => ({
          name: i.name,
          amount: i.amount,
          frequency: i.frequency,
          nextPayDate: i.next_pay_date,
        })),
        expenses: fixedExpenseRows.map((e: any) => ({
          name: e.name,
          amount: e.amount,
          frequency: e.frequency,
          nextDueDate: e.next_due_date,
        })),
        bnplPayments: bnplPlanRows.map((p: any) => {
          const account = bnplAccountRows.find(
            (a: any) => a.id === p.bnpl_account_id
          );
          return {
            itemName: p.item_name,
            provider: account?.provider || "unknown",
            instalmentAmount: p.instalment_amount,
            instalmentFrequency: p.instalment_frequency,
            instalmentsRemaining: p.instalments_remaining,
            nextPaymentDate: p.next_payment_date,
          };
        }),
        creditCards: creditCards
          .filter((c: any) => c.balance > 0)
          .map((c: any) => ({
            name: c.name,
            balance: c.balance,
            minimumPayment: Math.max(2500, Math.ceil(c.balance * 0.02)),
            dueDate: c.due_date || 15,
          })),
      });
      safeToSpend = sts.safeToSpend;
      daysUntilPay = sts.daysUntilPay;
    }

    // Build Zip-specific context
    const zipAccount = bnplAccountRows.find(
      (a: any) => a.provider === "zip_pay" || a.provider === "zip_money"
    );
    const zipContext = zipAccount
      ? {
          currentBalance:
            (zipAccount.spending_limit - zipAccount.available_limit) / 100,
          spendingLimit: zipAccount.spending_limit / 100,
          availableLimit: zipAccount.available_limit / 100,
        }
      : null;

    // Build existing BNPL plans context
    const existingPlans = bnplPlanRows.map((p: any) => {
      const account = bnplAccountRows.find(
        (a: any) => a.id === p.bnpl_account_id
      );
      const remaining =
        (p.instalment_amount * p.instalments_remaining) /
        100;
      // Estimate monthly payment based on frequency
      let monthlyPayment = p.instalment_amount / 100;
      if (p.instalment_frequency === "weekly")
        monthlyPayment *= 4.33;
      else if (p.instalment_frequency === "fortnightly")
        monthlyPayment *= 2.17;

      return {
        provider: account?.provider || "unknown",
        itemName: p.item_name,
        remainingAmount: remaining,
        monthlyPayment,
      };
    });

    const advice = await getAffordabilityAdvice({
      item: {
        name: item.name,
        price: item.price / 100,
        store: item.store,
      },
      financialSnapshot: {
        totalBankBalance: totalBankBalance / 100,
        safeToSpend: safeToSpend / 100,
        totalCreditCardDebt: totalCreditCardDebt / 100,
        totalBnplDebt: totalBnplDebt / 100,
        netPosition:
          (totalBankBalance - totalCreditCardDebt - totalBnplDebt) / 100,
        monthlyIncome: Math.round(totalMonthlyIncome) / 100,
        monthlyExpenses: Math.round(totalMonthlyExpenses) / 100,
        monthlySurplus:
          Math.round(totalMonthlyIncome - totalMonthlyExpenses) / 100,
        daysUntilPay,
      },
      zipAccount: zipContext,
      existingBnplPlans: existingPlans,
    });

    return NextResponse.json({
      item: {
        id: item.id,
        name: item.name,
        price: item.price,
        store: item.store,
      },
      advice,
    });
  } catch (error) {
    console.error("Affordability check error:", error);
    return NextResponse.json(
      { error: "Failed to check affordability" },
      { status: 500 }
    );
  }
}
