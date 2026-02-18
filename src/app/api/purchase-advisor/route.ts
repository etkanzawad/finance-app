import { db } from "@/lib/db";
import {
  accounts,
  income,
  fixedExpenses,
  bnplAccounts,
  bnplPlans,
  savingsGoals,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { projectCashflow, type CashflowEvent } from "@/lib/cashflow";
import { getPurchaseAdvice } from "@/lib/gemini";
import { NextRequest, NextResponse } from "next/server";
import { addDays, format } from "date-fns";

interface PaymentScheduleItem {
  date: string;
  amount: number; // cents
  label: string;
}

interface Strategy {
  name: string;
  provider: string;
  available: boolean;
  reason?: string;
  totalCost: number; // cents - total including fees/interest
  totalFees: number; // cents - fees/interest only
  schedule: PaymentScheduleItem[];
  cashflowProjection: { date: string; balance: number }[];
  minBalance: number; // cents - lowest projected balance
  savingsImpact: number; // cents - how much savings goal progress is delayed
  score: number; // 0-100 composite score
}

// Provider-specific rules
const PROVIDER_RULES: Record<
  string,
  {
    label: string;
    instalments: number;
    frequency: "fortnightly" | "monthly" | "weekly";
    lateFee: number; // cents
    monthlyFee: number; // cents
    interestRate: number; // annual percentage, 0 if interest-free
    minAmount: number; // cents
    maxAmount: number; // cents
    interestFreeMonths: number;
  }
> = {
  afterpay: {
    label: "Afterpay",
    instalments: 4,
    frequency: "fortnightly",
    lateFee: 1000, // $10 initial late fee, +$7 if unpaid after 7 days, capped at 25% of order or $68
    monthlyFee: 0,
    interestRate: 0,
    minAmount: 100,
    maxAmount: 200000, // up to $2000, varies by retailer and account standing
    interestFreeMonths: 0,
  },
  zip_pay: {
    label: "Zip Pay",
    instalments: 1, // flexible repayment
    frequency: "monthly",
    lateFee: 0,
    monthlyFee: 995, // $9.95/month account fee
    interestRate: 0, // interest-free under $1000
    minAmount: 100,
    maxAmount: 100000,
    interestFreeMonths: 0,
  },
  zip_money: {
    label: "Zip Money",
    instalments: 12, // longer terms
    frequency: "monthly",
    lateFee: 0,
    monthlyFee: 995,
    interestRate: 19.9,
    minAmount: 100000,
    maxAmount: 500000,
    interestFreeMonths: 3,
  },
  paypal_pay4: {
    label: "PayPal Pay in 4",
    instalments: 4,
    frequency: "fortnightly",
    lateFee: 0,
    monthlyFee: 0,
    interestRate: 0,
    minAmount: 3000,
    maxAmount: 150000,
    interestFreeMonths: 0,
  },
};

function buildBnplStrategy(
  provider: string,
  rules: (typeof PROVIDER_RULES)[string],
  price: number,
  availableLimit: number,
  baseProjection: { date: string; balance: number }[],
  startingBalance: number,
  baseEvents: CashflowEvent[]
): Strategy {
  const today = new Date();
  const schedule: PaymentScheduleItem[] = [];
  let totalFees = 0;

  if (price > availableLimit) {
    return {
      name: rules.label,
      provider,
      available: false,
      reason: `Insufficient limit ($${(availableLimit / 100).toFixed(2)} available, need $${(price / 100).toFixed(2)})`,
      totalCost: price,
      totalFees: 0,
      schedule: [],
      cashflowProjection: baseProjection,
      minBalance: Math.min(...baseProjection.map((d) => d.balance)),
      savingsImpact: 0,
      score: 0,
    };
  }

  if (price < rules.minAmount || price > rules.maxAmount) {
    return {
      name: rules.label,
      provider,
      available: false,
      reason: `Amount outside range ($${(rules.minAmount / 100).toFixed(2)} - $${(rules.maxAmount / 100).toFixed(2)})`,
      totalCost: price,
      totalFees: 0,
      schedule: [],
      cashflowProjection: baseProjection,
      minBalance: Math.min(...baseProjection.map((d) => d.balance)),
      savingsImpact: 0,
      score: 0,
    };
  }

  if (provider === "zip_pay") {
    // Zip Pay: pay minimum $40/month or 3% of balance, whichever is greater
    const monthlyPayment = Math.max(4000, Math.ceil(price * 0.03));
    let remaining = price;
    let monthOffset = 0;
    while (remaining > 0 && monthOffset < 24) {
      const paymentDate = new Date(today);
      paymentDate.setMonth(paymentDate.getMonth() + monthOffset + 1);
      const payment = Math.min(monthlyPayment, remaining);
      schedule.push({
        date: format(paymentDate, "yyyy-MM-dd"),
        amount: payment,
        label: `Zip Pay payment ${monthOffset + 1}`,
      });
      remaining -= payment;
      monthOffset++;
    }
    // Account fee for each month of repayment
    totalFees = rules.monthlyFee * monthOffset;
  } else if (provider === "zip_money") {
    // Zip Money: interest-free for promo period, then interest applies
    const monthlyPayment = Math.ceil(price / rules.instalments);
    let remaining = price;
    for (let i = 0; i < rules.instalments && remaining > 0; i++) {
      const paymentDate = new Date(today);
      paymentDate.setMonth(paymentDate.getMonth() + i + 1);
      const payment = Math.min(monthlyPayment, remaining);
      schedule.push({
        date: format(paymentDate, "yyyy-MM-dd"),
        amount: payment,
        label: `Zip Money payment ${i + 1}${i >= rules.interestFreeMonths ? " (interest applies)" : ""}`,
      });
      // Interest on remaining balance after promo period
      if (i >= rules.interestFreeMonths) {
        const monthlyInterest = Math.ceil(
          (remaining * rules.interestRate) / 100 / 12
        );
        totalFees += monthlyInterest;
      }
      remaining -= payment;
    }
    totalFees += rules.monthlyFee * rules.instalments;
  } else {
    // Standard BNPL: equal instalments
    const instalmentAmount = Math.ceil(price / rules.instalments);
    const frequencyDays = rules.frequency === "fortnightly" ? 14 : rules.frequency === "weekly" ? 7 : 30;

    for (let i = 0; i < rules.instalments; i++) {
      const paymentDate = addDays(today, i * frequencyDays);
      const payment =
        i === rules.instalments - 1
          ? price - instalmentAmount * (rules.instalments - 1)
          : instalmentAmount;
      schedule.push({
        date: format(paymentDate, "yyyy-MM-dd"),
        amount: payment,
        label: `${rules.label} payment ${i + 1}/${rules.instalments}`,
      });
    }
  }

  const totalCost = price + totalFees;

  // Build cashflow projection with this strategy's payments
  const purchaseEvents: CashflowEvent[] = schedule.map((s) => ({
    date: new Date(s.date),
    description: s.label,
    amount: -s.amount,
    type: "purchase" as const,
  }));

  const strategyProjection = projectCashflow({
    startingBalance,
    incomes: [],
    expenses: [],
    bnplPayments: [],
    creditCards: [],
    weeksAhead: 8,
    additionalEvents: [...baseEvents, ...purchaseEvents],
  });

  const projectionData = strategyProjection.map((d) => ({
    date: d.date,
    balance: d.balance,
  }));

  const minBalance = Math.min(...projectionData.map((d) => d.balance));

  return {
    name: rules.label,
    provider,
    available: true,
    totalCost,
    totalFees,
    schedule,
    cashflowProjection: projectionData,
    minBalance,
    savingsImpact: 0,
    score: 0,
  };
}

function scoreStrategy(
  strategy: Strategy,
  price: number,
  allStrategies: Strategy[]
): number {
  if (!strategy.available) return 0;

  // Cost score (40%): lower total cost is better
  const maxCost = Math.max(...allStrategies.filter((s) => s.available).map((s) => s.totalCost), price);
  const costScore = maxCost > 0 ? (1 - strategy.totalFees / maxCost) * 100 : 100;

  // Cashflow stress score (40%): higher minimum balance is better
  const cashflowScore = strategy.minBalance >= 0
    ? Math.min(100, (strategy.minBalance / 10000) * 100)
    : Math.max(0, 50 + (strategy.minBalance / 10000) * 50);

  // Simplicity score (20%): fewer payments is simpler
  const simplicityScore = Math.max(0, 100 - (strategy.schedule.length - 1) * 15);

  return Math.round(costScore * 0.4 + cashflowScore * 0.4 + simplicityScore * 0.2);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { item, price, urgency } = body as {
      item: string;
      price: number; // cents
      urgency?: string;
    };

    if (!item || !price || price <= 0) {
      return NextResponse.json(
        { error: "Item name and valid price are required" },
        { status: 400 }
      );
    }

    // Fetch all financial data
    const [
      allAccounts,
      allIncome,
      allExpenses,
      allBnplAccounts,
      allBnplPlans,
      allSavingsGoals,
    ] = await Promise.all([
      db.select().from(accounts),
      db.select().from(income),
      db.select().from(fixedExpenses).where(eq(fixedExpenses.isActive, true)),
      db.select().from(bnplAccounts).where(eq(bnplAccounts.isActive, true)),
      db.select().from(bnplPlans),
      db.select().from(savingsGoals),
    ]);

    // Calculate starting balance from bank accounts
    const bankAccounts = allAccounts.filter((a) => a.type === "bank");
    const startingBalance = bankAccounts.reduce((sum, a) => sum + a.balance, 0);

    // Build cashflow inputs
    const incomeInputs = allIncome.map((i) => ({
      name: i.name,
      amount: i.amount,
      frequency: i.frequency,
      nextPayDate: i.nextPayDate,
    }));

    const expenseInputs = allExpenses.map((e) => ({
      name: e.name,
      amount: e.amount,
      frequency: e.frequency,
      nextDueDate: e.nextDueDate,
    }));

    const bnplPaymentInputs = allBnplPlans
      .filter((p) => p.instalmentsRemaining > 0)
      .map((p) => {
        const account = allBnplAccounts.find((a) => a.id === p.bnplAccountId);
        return {
          itemName: p.itemName,
          provider: account?.provider || "unknown",
          instalmentAmount: p.instalmentAmount,
          instalmentFrequency: p.instalmentFrequency,
          instalmentsRemaining: p.instalmentsRemaining,
          nextPaymentDate: p.nextPaymentDate,
        };
      });

    const creditCardInputs = allAccounts
      .filter((a) => a.type === "credit_card" && a.balance > 0)
      .map((a) => ({
        name: a.name,
        balance: a.balance,
        minimumPayment: Math.max(2500, Math.ceil(a.balance * 0.02)), // $25 or 2%
        dueDate: a.dueDate || 15,
      }));

    // Base cashflow projection (without purchase)
    const baseProjection = projectCashflow({
      startingBalance,
      incomes: incomeInputs,
      expenses: expenseInputs,
      bnplPayments: bnplPaymentInputs,
      creditCards: creditCardInputs,
      weeksAhead: 8,
    });

    // Collect base events for reuse in strategy projections
    const baseEvents: CashflowEvent[] = [];
    for (const day of baseProjection) {
      baseEvents.push(...day.events);
    }

    const baseProjectionData = baseProjection.map((d) => ({
      date: d.date,
      balance: d.balance,
    }));

    // Build strategies
    const strategies: Strategy[] = [];

    // Strategy 1: Cash (immediate payment)
    const cashEvents: CashflowEvent[] = [
      {
        date: new Date(),
        description: `Buy ${item} (cash)`,
        amount: -price,
        type: "purchase",
      },
    ];
    const cashProjection = projectCashflow({
      startingBalance,
      incomes: incomeInputs,
      expenses: expenseInputs,
      bnplPayments: bnplPaymentInputs,
      creditCards: creditCardInputs,
      weeksAhead: 8,
      additionalEvents: cashEvents,
    });
    const cashProjectionData = cashProjection.map((d) => ({
      date: d.date,
      balance: d.balance,
    }));
    const cashMinBalance = Math.min(...cashProjectionData.map((d) => d.balance));

    strategies.push({
      name: "Cash / Debit",
      provider: "cash",
      available: startingBalance >= price,
      reason: startingBalance < price ? "Insufficient funds" : undefined,
      totalCost: price,
      totalFees: 0,
      schedule: [
        {
          date: format(new Date(), "yyyy-MM-dd"),
          amount: price,
          label: "Full payment today",
        },
      ],
      cashflowProjection: cashProjectionData,
      minBalance: cashMinBalance,
      savingsImpact: 0,
      score: 0,
    });

    // Strategy 2: Credit card(s)
    const creditCards = allAccounts.filter((a) => a.type === "credit_card");
    for (const cc of creditCards) {
      const available = (cc.creditLimit || 0) - cc.balance;
      if (available < price) {
        strategies.push({
          name: `${cc.name} (Credit Card)`,
          provider: "credit_card",
          available: false,
          reason: `Insufficient limit ($${(available / 100).toFixed(2)} available)`,
          totalCost: price,
          totalFees: 0,
          schedule: [],
          cashflowProjection: baseProjectionData,
          minBalance: Math.min(...baseProjectionData.map((d) => d.balance)),
          savingsImpact: 0,
          score: 0,
        });
        continue;
      }

      const rate = parseFloat(cc.interestRate || "19.99");
      const dueDay = cc.dueDate || 15;

      // Option A: Pay in full by due date (no interest)
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + 1);
      dueDate.setDate(Math.min(dueDay, 28));

      const ccFullEvents: CashflowEvent[] = [
        {
          date: dueDate,
          description: `Pay ${cc.name} in full for ${item}`,
          amount: -price,
          type: "credit_card",
        },
      ];
      const ccFullProjection = projectCashflow({
        startingBalance,
        incomes: incomeInputs,
        expenses: expenseInputs,
        bnplPayments: bnplPaymentInputs,
        creditCards: creditCardInputs,
        weeksAhead: 8,
        additionalEvents: ccFullEvents,
      });
      const ccFullData = ccFullProjection.map((d) => ({
        date: d.date,
        balance: d.balance,
      }));

      strategies.push({
        name: `${cc.name} (Pay in Full)`,
        provider: "credit_card",
        available: true,
        totalCost: price,
        totalFees: 0,
        schedule: [
          {
            date: format(dueDate, "yyyy-MM-dd"),
            amount: price,
            label: `Pay in full by due date`,
          },
        ],
        cashflowProjection: ccFullData,
        minBalance: Math.min(...ccFullData.map((d) => d.balance)),
        savingsImpact: 0,
        score: 0,
      });

      // Option B: Minimum payments (with interest)
      const minPayment = Math.max(2500, Math.ceil(price * 0.02));
      const ccMinSchedule: PaymentScheduleItem[] = [];
      let remaining = price;
      let totalInterest = 0;
      let monthOffset = 0;

      while (remaining > 0 && monthOffset < 24) {
        const monthlyInterest = Math.ceil((remaining * rate) / 100 / 12);
        totalInterest += monthlyInterest;
        remaining += monthlyInterest;

        const payment = Math.min(minPayment, remaining);
        remaining -= payment;

        const payDate = new Date();
        payDate.setMonth(payDate.getMonth() + monthOffset + 1);
        payDate.setDate(Math.min(dueDay, 28));

        ccMinSchedule.push({
          date: format(payDate, "yyyy-MM-dd"),
          amount: payment,
          label: `${cc.name} min payment ${monthOffset + 1}`,
        });
        monthOffset++;
      }

      const ccMinEvents: CashflowEvent[] = ccMinSchedule.map((s) => ({
        date: new Date(s.date),
        description: s.label,
        amount: -s.amount,
        type: "credit_card" as const,
      }));
      const ccMinProjection = projectCashflow({
        startingBalance,
        incomes: incomeInputs,
        expenses: expenseInputs,
        bnplPayments: bnplPaymentInputs,
        creditCards: creditCardInputs,
        weeksAhead: 8,
        additionalEvents: ccMinEvents,
      });
      const ccMinData = ccMinProjection.map((d) => ({
        date: d.date,
        balance: d.balance,
      }));

      strategies.push({
        name: `${cc.name} (Min Payments)`,
        provider: "credit_card",
        available: true,
        totalCost: price + totalInterest,
        totalFees: totalInterest,
        schedule: ccMinSchedule,
        cashflowProjection: ccMinData,
        minBalance: Math.min(...ccMinData.map((d) => d.balance)),
        savingsImpact: 0,
        score: 0,
      });
    }

    // BNPL strategies
    for (const bnplAccount of allBnplAccounts) {
      const rules = PROVIDER_RULES[bnplAccount.provider];
      if (!rules) continue;

      const strategy = buildBnplStrategy(
        bnplAccount.provider,
        rules,
        price,
        bnplAccount.availableLimit,
        baseProjectionData,
        startingBalance,
        baseEvents
      );
      strategies.push(strategy);
    }

    // Calculate savings impact for each strategy
    const totalSavingsTarget = allSavingsGoals.reduce(
      (sum, g) => sum + (g.targetAmount - g.currentAmount),
      0
    );
    for (const strategy of strategies) {
      if (!strategy.available) continue;
      // How much of the total cost eats into potential savings
      strategy.savingsImpact =
        totalSavingsTarget > 0
          ? Math.min(strategy.totalCost, totalSavingsTarget)
          : 0;
    }

    // Score all strategies
    for (const strategy of strategies) {
      strategy.score = scoreStrategy(strategy, price, strategies);
    }

    // Sort by score descending
    strategies.sort((a, b) => {
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      return b.score - a.score;
    });

    // Build financial snapshot for Gemini
    const financialSnapshot = {
      bankBalance: startingBalance,
      totalIncome: incomeInputs.reduce((sum, i) => sum + i.amount, 0),
      incomeFrequency: incomeInputs[0]?.frequency || "fortnightly",
      monthlyExpenses: expenseInputs.reduce((sum, e) => {
        const multiplier =
          e.frequency === "weekly"
            ? 4.33
            : e.frequency === "fortnightly"
              ? 2.17
              : e.frequency === "quarterly"
                ? 0.33
                : e.frequency === "yearly"
                  ? 0.083
                  : 1;
        return sum + e.amount * multiplier;
      }, 0),
      existingBnplCommitments: bnplPaymentInputs.length,
      creditCardDebt: creditCardInputs.reduce((sum, c) => sum + c.balance, 0),
    };

    // Get Gemini advice
    let geminiAdvice = null;
    const availableStrategies = strategies.filter((s) => s.available);
    if (availableStrategies.length > 0) {
      try {
        geminiAdvice = await getPurchaseAdvice({
          item,
          price,
          financialSnapshot,
          strategies: availableStrategies.map((s) => ({
            name: s.name,
            totalCost: s.totalCost,
            totalFees: s.totalFees,
            minBalance: s.minBalance,
            schedule: s.schedule,
            score: s.score,
          })),
          savingsGoals: allSavingsGoals.map((g) => ({
            name: g.name,
            target: g.targetAmount,
            current: g.currentAmount,
            deadline: g.deadline,
          })),
          urgency,
        });
      } catch {
        // Gemini is optional - continue without it
        geminiAdvice = null;
      }
    }

    return NextResponse.json({
      item,
      price,
      strategies,
      baseProjection: baseProjectionData,
      geminiAdvice,
      financialSnapshot,
    });
  } catch (error) {
    console.error("Purchase advisor error:", error);
    return NextResponse.json(
      { error: "Failed to analyse purchase" },
      { status: 500 }
    );
  }
}
