import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { prioritiseWishlist } from "@/lib/gemini";

export async function POST() {
  try {
    // Gather all needed data in parallel
    const [items, incomes, bankAccounts, creditCards, bnplPlans, fixedExpenses, goals] =
      await Promise.all([
        db
          .select()
          .from(schema.wishlistItems)
          .where(
            sql`${schema.wishlistItems.status} IN ('wanted', 'saving')`
          )
          .orderBy(schema.wishlistItems.priority),
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
          .select()
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
        db.select().from(schema.savingsGoals),
      ]);

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No active wishlist items to prioritise" },
        { status: 400 }
      );
    }

    const totalBankBalance = bankAccounts.reduce((sum, a) => sum + a.balance, 0);
    const totalCreditCardDebt = creditCards.reduce((sum, a) => sum + a.balance, 0);
    const totalBnplDebt = bnplPlans.reduce(
      (sum, p) => sum + p.bnpl_plans.instalmentAmount * p.bnpl_plans.instalmentsRemaining,
      0
    );
    const totalMonthlyIncome = incomes.reduce((sum, i) => {
      if (i.frequency === "weekly") return sum + i.amount * 4.33;
      if (i.frequency === "fortnightly") return sum + i.amount * 2.17;
      return sum + i.amount;
    }, 0);
    const totalMonthlyExpenses = fixedExpenses.reduce((sum, e) => {
      if (e.frequency === "weekly") return sum + e.amount * 4.33;
      if (e.frequency === "fortnightly") return sum + e.amount * 2.17;
      if (e.frequency === "quarterly") return sum + e.amount / 3;
      if (e.frequency === "yearly") return sum + e.amount / 12;
      return sum + e.amount;
    }, 0);

    const result = await prioritiseWishlist({
      items: items.map((i) => ({
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
      savingsGoals: goals.map((g) => ({
        name: g.name,
        target: g.targetAmount / 100,
        current: g.currentAmount / 100,
        progress: g.targetAmount > 0 ? ((g.currentAmount / g.targetAmount) * 100).toFixed(1) + "%" : "0%",
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
