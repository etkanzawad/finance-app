import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { getAffordabilityAdvice } from "@/lib/gemini";
import { calculateSafeToSpend } from "@/lib/cashflow";

export async function POST(request: NextRequest) {
  try {
    const { wishlistItemId } = await request.json();

    if (!wishlistItemId) {
      return NextResponse.json(
        { error: "wishlistItemId is required" },
        { status: 400 }
      );
    }

    const [
      itemRows,
      incomes,
      bankAccounts,
      creditCards,
      bnplAccountRows,
      bnplPlanRows,
      fixedExpenseRows,
    ] = await Promise.all([
      db
        .select()
        .from(schema.wishlistItems)
        .where(eq(schema.wishlistItems.id, wishlistItemId)),
      db.select().from(schema.income),
      db.select().from(schema.accounts).where(eq(schema.accounts.type, "bank")),
      db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.type, "credit_card")),
      db
        .select()
        .from(schema.bnplAccounts)
        .where(eq(schema.bnplAccounts.isActive, true)),
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
    ]);

    const item = itemRows[0];
    if (!item) {
      return NextResponse.json(
        { error: "Wishlist item not found" },
        { status: 404 }
      );
    }

    // Calculate financial snapshot
    const totalBankBalance = bankAccounts.reduce(
      (sum, a) => sum + a.balance,
      0
    );
    const totalCreditCardDebt = creditCards.reduce(
      (sum, a) => sum + a.balance,
      0
    );
    const totalBnplDebt = bnplPlanRows.reduce(
      (sum, p) =>
        sum +
        p.bnpl_plans.instalmentAmount * p.bnpl_plans.instalmentsRemaining,
      0
    );
    const totalMonthlyIncome = incomes.reduce((sum, i) => {
      if (i.frequency === "weekly") return sum + i.amount * 4.33;
      if (i.frequency === "fortnightly") return sum + i.amount * 2.17;
      return sum + i.amount;
    }, 0);
    const totalMonthlyExpenses = fixedExpenseRows.reduce((sum, e) => {
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
        incomes: incomes.map((i) => ({
          name: i.name,
          amount: i.amount,
          frequency: i.frequency,
          nextPayDate: i.nextPayDate,
        })),
        expenses: fixedExpenseRows.map((e) => ({
          name: e.name,
          amount: e.amount,
          frequency: e.frequency,
          nextDueDate: e.nextDueDate,
        })),
        bnplPayments: bnplPlanRows.map((p) => {
          const account = bnplAccountRows.find(
            (a) => a.id === p.bnpl_plans.bnplAccountId
          );
          return {
            itemName: p.bnpl_plans.itemName,
            provider: account?.provider || "unknown",
            instalmentAmount: p.bnpl_plans.instalmentAmount,
            instalmentFrequency: p.bnpl_plans.instalmentFrequency,
            instalmentsRemaining: p.bnpl_plans.instalmentsRemaining,
            nextPaymentDate: p.bnpl_plans.nextPaymentDate,
          };
        }),
        creditCards: creditCards
          .filter((c) => c.balance > 0)
          .map((c) => ({
            name: c.name,
            balance: c.balance,
            minimumPayment: Math.max(2500, Math.ceil(c.balance * 0.02)),
            dueDate: c.dueDate || 15,
          })),
      });
      safeToSpend = sts.safeToSpend;
      daysUntilPay = sts.daysUntilPay;
    }

    // Build Zip-specific context
    const zipAccount = bnplAccountRows.find(
      (a) => a.provider === "zip_pay" || a.provider === "zip_money"
    );
    const zipContext = zipAccount
      ? {
          currentBalance:
            (zipAccount.spendingLimit - zipAccount.availableLimit) / 100,
          spendingLimit: zipAccount.spendingLimit / 100,
          availableLimit: zipAccount.availableLimit / 100,
        }
      : null;

    // Build existing BNPL plans context
    const existingPlans = bnplPlanRows.map((p) => {
      const account = bnplAccountRows.find(
        (a) => a.id === p.bnpl_plans.bnplAccountId
      );
      const remaining =
        (p.bnpl_plans.instalmentAmount * p.bnpl_plans.instalmentsRemaining) /
        100;
      // Estimate monthly payment based on frequency
      let monthlyPayment = p.bnpl_plans.instalmentAmount / 100;
      if (p.bnpl_plans.instalmentFrequency === "weekly")
        monthlyPayment *= 4.33;
      else if (p.bnpl_plans.instalmentFrequency === "fortnightly")
        monthlyPayment *= 2.17;

      return {
        provider: account?.provider || "unknown",
        itemName: p.bnpl_plans.itemName,
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
