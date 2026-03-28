import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prioritiseWishlist } from "@/lib/gemini";

export async function POST() {
  try {
    const supabase = await createClient();

    // Gather all needed data in parallel
    const [itemsResult, incomesResult, bankAccountsResult, creditCardsResult, bnplPlansResult, fixedExpensesResult, goalsResult] =
      await Promise.all([
        supabase
          .from("wishlist_items")
          .select("*")
          .in("status", ["wanted", "saving"])
          .order("priority"),
        supabase.from("income").select("*"),
        supabase.from("accounts").select("*").eq("type", "bank"),
        supabase.from("accounts").select("*").eq("type", "credit_card"),
        supabase
          .from("bnpl_plans")
          .select("*, bnpl_accounts!inner(*)")
          .gt("instalments_remaining", 0)
          .eq("bnpl_accounts.is_active", true),
        supabase.from("fixed_expenses").select("*").eq("is_active", true),
        supabase.from("savings_goals").select("*"),
      ]);

    const items = itemsResult.data || [];
    const incomes = incomesResult.data || [];
    const bankAccounts = bankAccountsResult.data || [];
    const creditCards = creditCardsResult.data || [];
    const bnplPlans = bnplPlansResult.data || [];
    const fixedExpenses = fixedExpensesResult.data || [];
    const goals = goalsResult.data || [];

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No active wishlist items to prioritise" },
        { status: 400 }
      );
    }

    const totalBankBalance = bankAccounts.reduce((sum: number, a: any) => sum + a.balance, 0);
    const totalCreditCardDebt = creditCards.reduce((sum: number, a: any) => sum + a.balance, 0);
    const totalBnplDebt = bnplPlans.reduce(
      (sum: number, p: any) => sum + p.instalment_amount * p.instalments_remaining,
      0
    );
    const totalMonthlyIncome = incomes.reduce((sum: number, i: any) => {
      if (i.frequency === "weekly") return sum + i.amount * 4.33;
      if (i.frequency === "fortnightly") return sum + i.amount * 2.17;
      return sum + i.amount;
    }, 0);
    const totalMonthlyExpenses = fixedExpenses.reduce((sum: number, e: any) => {
      if (e.frequency === "weekly") return sum + e.amount * 4.33;
      if (e.frequency === "fortnightly") return sum + e.amount * 2.17;
      if (e.frequency === "quarterly") return sum + e.amount / 3;
      if (e.frequency === "yearly") return sum + e.amount / 12;
      return sum + e.amount;
    }, 0);

    const result = await prioritiseWishlist({
      items: items.map((i: any) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        priority: i.priority,
        category: i.category,
        notes: i.notes,
        status: i.status,
      })),
      financialSnapshot: {
        totalBankBalance: totalBankBalance / 100,
        totalCreditCardDebt: totalCreditCardDebt / 100,
        totalBnplDebt: totalBnplDebt / 100,
        netPosition: (totalBankBalance - totalCreditCardDebt - totalBnplDebt) / 100,
        monthlyIncome: Math.round(totalMonthlyIncome) / 100,
        monthlyExpenses: Math.round(totalMonthlyExpenses) / 100,
        monthlySurplus: Math.round(totalMonthlyIncome - totalMonthlyExpenses) / 100,
      },
      savingsGoals: goals.map((g: any) => ({
        name: g.name,
        target: g.target_amount / 100,
        current: g.current_amount / 100,
        progress: g.target_amount > 0 ? ((g.current_amount / g.target_amount) * 100).toFixed(1) + "%" : "0%",
      })),
      bnplExposure: totalBnplDebt,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Wishlist prioritise error:", error);
    return NextResponse.json(
      { error: "Failed to prioritise wishlist" },
      { status: 500 }
    );
  }
}
