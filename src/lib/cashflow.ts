import { addDays, addWeeks, isAfter, isBefore, isSameDay, startOfDay, format } from "date-fns";

export interface CashflowEvent {
  date: Date;
  description: string;
  amount: number; // cents, positive = inflow, negative = outflow
  type: "income" | "expense" | "bnpl" | "credit_card" | "purchase";
}

export interface DailyBalance {
  date: string; // YYYY-MM-DD
  balance: number; // cents
  events: CashflowEvent[];
}

export interface IncomeInput {
  name: string;
  amount: number;
  frequency: "weekly" | "fortnightly" | "monthly";
  nextPayDate: string;
}

export interface ExpenseInput {
  name: string;
  amount: number;
  frequency: "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly";
  nextDueDate: string;
}

export interface BnplPaymentInput {
  itemName: string;
  provider: string;
  instalmentAmount: number;
  instalmentFrequency: "weekly" | "fortnightly" | "monthly";
  instalmentsRemaining: number;
  nextPaymentDate: string;
}

export interface CreditCardInput {
  name: string;
  balance: number;
  minimumPayment: number;
  dueDate: number; // day of month
}

function getNextOccurrences(
  startDate: string,
  frequency: string,
  from: Date,
  to: Date
): Date[] {
  const dates: Date[] = [];
  let current = startOfDay(new Date(startDate));

  // Move to first occurrence on or after 'from'
  while (isBefore(current, from) && !isSameDay(current, from)) {
    current = advanceByFrequency(current, frequency);
  }

  while (isBefore(current, to) || isSameDay(current, to)) {
    dates.push(new Date(current));
    current = advanceByFrequency(current, frequency);
  }

  return dates;
}

function advanceByFrequency(date: Date, frequency: string): Date {
  switch (frequency) {
    case "weekly":
      return addDays(date, 7);
    case "fortnightly":
      return addDays(date, 14);
    case "monthly": {
      const next = new Date(date);
      next.setMonth(next.getMonth() + 1);
      return next;
    }
    case "quarterly": {
      const next = new Date(date);
      next.setMonth(next.getMonth() + 3);
      return next;
    }
    case "yearly": {
      const next = new Date(date);
      next.setFullYear(next.getFullYear() + 1);
      return next;
    }
    default:
      return addDays(date, 30);
  }
}

function getCreditCardDueDates(dayOfMonth: number, from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  let current = new Date(from.getFullYear(), from.getMonth(), dayOfMonth);
  if (isBefore(current, from)) {
    current.setMonth(current.getMonth() + 1);
  }
  while (isBefore(current, to) || isSameDay(current, to)) {
    dates.push(new Date(current));
    current = new Date(current);
    current.setMonth(current.getMonth() + 1);
  }
  return dates;
}

export function projectCashflow(params: {
  startingBalance: number;
  incomes: IncomeInput[];
  expenses: ExpenseInput[];
  bnplPayments: BnplPaymentInput[];
  creditCards: CreditCardInput[];
  weeksAhead?: number;
  additionalEvents?: CashflowEvent[];
}): DailyBalance[] {
  const {
    startingBalance,
    incomes,
    expenses,
    bnplPayments,
    creditCards,
    weeksAhead = 8,
    additionalEvents = [],
  } = params;

  const today = startOfDay(new Date());
  const endDate = addWeeks(today, weeksAhead);

  // Collect all events
  const events: CashflowEvent[] = [...additionalEvents];

  // Income events
  for (const inc of incomes) {
    const dates = getNextOccurrences(inc.nextPayDate, inc.frequency, today, endDate);
    for (const date of dates) {
      events.push({
        date,
        description: inc.name,
        amount: inc.amount,
        type: "income",
      });
    }
  }

  // Fixed expense events
  for (const exp of expenses) {
    const dates = getNextOccurrences(exp.nextDueDate, exp.frequency, today, endDate);
    for (const date of dates) {
      events.push({
        date,
        description: exp.name,
        amount: -exp.amount,
        type: "expense",
      });
    }
  }

  // BNPL payment events
  for (const bnpl of bnplPayments) {
    const dates = getNextOccurrences(
      bnpl.nextPaymentDate,
      bnpl.instalmentFrequency,
      today,
      endDate
    );
    const maxPayments = Math.min(dates.length, bnpl.instalmentsRemaining);
    for (let i = 0; i < maxPayments; i++) {
      events.push({
        date: dates[i],
        description: `${bnpl.provider} - ${bnpl.itemName}`,
        amount: -bnpl.instalmentAmount,
        type: "bnpl",
      });
    }
  }

  // Credit card minimum payments
  for (const cc of creditCards) {
    if (cc.balance > 0 && cc.minimumPayment > 0) {
      const dates = getCreditCardDueDates(cc.dueDate, today, endDate);
      for (const date of dates) {
        events.push({
          date,
          description: `${cc.name} minimum payment`,
          amount: -cc.minimumPayment,
          type: "credit_card",
        });
      }
    }
  }

  // Build daily balances
  const dailyBalances: DailyBalance[] = [];
  let runningBalance = startingBalance;
  let currentDate = new Date(today);

  while (isBefore(currentDate, endDate) || isSameDay(currentDate, endDate)) {
    const dayEvents = events.filter((e) => isSameDay(e.date, currentDate));
    for (const event of dayEvents) {
      runningBalance += event.amount;
    }
    dailyBalances.push({
      date: format(currentDate, "yyyy-MM-dd"),
      balance: runningBalance,
      events: dayEvents,
    });
    currentDate = addDays(currentDate, 1);
  }

  return dailyBalances;
}

/** Calculate safe-to-spend for the current pay cycle */
export function calculateSafeToSpend(params: {
  currentBalance: number;
  incomes: IncomeInput[];
  expenses: ExpenseInput[];
  bnplPayments: BnplPaymentInput[];
  creditCards: CreditCardInput[];
}): {
  safeToSpend: number;
  nextPayDate: string;
  daysUntilPay: number;
  upcomingExpenses: { name: string; amount: number; date: string }[];
} {
  const today = startOfDay(new Date());

  // Find the next pay date
  let nextPayDate: Date | null = null;
  for (const inc of params.incomes) {
    let payDate = startOfDay(new Date(inc.nextPayDate));
    while (isBefore(payDate, today) || isSameDay(payDate, today)) {
      payDate = advanceByFrequency(payDate, inc.frequency);
    }
    if (!nextPayDate || isBefore(payDate, nextPayDate)) {
      nextPayDate = payDate;
    }
  }

  if (!nextPayDate) {
    nextPayDate = addDays(today, 14); // fallback
  }

  const daysUntilPay = Math.ceil(
    (nextPayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Sum all expenses between now and next pay
  let totalUpcoming = 0;
  const upcomingExpenses: { name: string; amount: number; date: string }[] = [];

  for (const exp of params.expenses) {
    const dates = getNextOccurrences(exp.nextDueDate, exp.frequency, today, nextPayDate);
    for (const date of dates) {
      totalUpcoming += exp.amount;
      upcomingExpenses.push({
        name: exp.name,
        amount: exp.amount,
        date: format(date, "yyyy-MM-dd"),
      });
    }
  }

  for (const bnpl of params.bnplPayments) {
    const dates = getNextOccurrences(
      bnpl.nextPaymentDate,
      bnpl.instalmentFrequency,
      today,
      nextPayDate
    );
    const maxPayments = Math.min(dates.length, bnpl.instalmentsRemaining);
    for (let i = 0; i < maxPayments; i++) {
      totalUpcoming += bnpl.instalmentAmount;
      upcomingExpenses.push({
        name: `${bnpl.provider} - ${bnpl.itemName}`,
        amount: bnpl.instalmentAmount,
        date: format(dates[i], "yyyy-MM-dd"),
      });
    }
  }

  for (const cc of params.creditCards) {
    if (cc.balance > 0 && cc.minimumPayment > 0) {
      const dates = getCreditCardDueDates(cc.dueDate, today, nextPayDate);
      for (const date of dates) {
        totalUpcoming += cc.minimumPayment;
        upcomingExpenses.push({
          name: `${cc.name} min. payment`,
          amount: cc.minimumPayment,
          date: format(date, "yyyy-MM-dd"),
        });
      }
    }
  }

  // Sort upcoming expenses by date
  upcomingExpenses.sort((a, b) => a.date.localeCompare(b.date));

  return {
    safeToSpend: params.currentBalance - totalUpcoming,
    nextPayDate: format(nextPayDate, "yyyy-MM-dd"),
    daysUntilPay,
    upcomingExpenses,
  };
}
