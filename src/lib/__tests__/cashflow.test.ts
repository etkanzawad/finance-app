import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { format, addDays, addWeeks } from "date-fns";
import {
  projectCashflow,
  calculateSafeToSpend,
  type IncomeInput,
  type ExpenseInput,
  type BnplPaymentInput,
  type CreditCardInput,
} from "@/lib/cashflow";

// Helper to create a fixed "today" and mock Date
const MOCK_TODAY = new Date(2025, 5, 1); // June 1, 2025 (Sunday)

function mockDate(date: Date) {
  vi.useFakeTimers();
  vi.setSystemTime(date);
}

function fmtDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

beforeEach(() => {
  mockDate(MOCK_TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// advanceByFrequency (tested indirectly via projectCashflow)
// ---------------------------------------------------------------------------
describe("advanceByFrequency (indirect)", () => {
  it("advances weekly income correctly", () => {
    const result = projectCashflow({
      startingBalance: 0,
      incomes: [
        { name: "Job", amount: 100_00, frequency: "weekly", nextPayDate: "2025-06-01" },
      ],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 3,
    });

    const incomeDays = result.filter((d) => d.events.some((e) => e.type === "income"));
    // Weekly starting June 1, 3 weeks ahead ends Jun 22 (inclusive): Jun 1, Jun 8, Jun 15, Jun 22
    expect(incomeDays).toHaveLength(4);
    expect(incomeDays[0].date).toBe("2025-06-01");
    expect(incomeDays[1].date).toBe("2025-06-08");
    expect(incomeDays[2].date).toBe("2025-06-15");
    expect(incomeDays[3].date).toBe("2025-06-22");
  });

  it("advances fortnightly correctly", () => {
    const result = projectCashflow({
      startingBalance: 0,
      incomes: [
        { name: "Job", amount: 200_00, frequency: "fortnightly", nextPayDate: "2025-06-01" },
      ],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 5,
    });

    const incomeDays = result.filter((d) => d.events.some((e) => e.type === "income"));
    expect(incomeDays).toHaveLength(3);
    expect(incomeDays[0].date).toBe("2025-06-01");
    expect(incomeDays[1].date).toBe("2025-06-15");
    expect(incomeDays[2].date).toBe("2025-06-29");
  });

  it("advances monthly correctly", () => {
    const result = projectCashflow({
      startingBalance: 0,
      incomes: [
        { name: "Salary", amount: 500_00, frequency: "monthly", nextPayDate: "2025-06-01" },
      ],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 10,
    });

    const incomeDays = result.filter((d) => d.events.some((e) => e.type === "income"));
    expect(incomeDays).toHaveLength(3);
    expect(incomeDays[0].date).toBe("2025-06-01");
    expect(incomeDays[1].date).toBe("2025-07-01");
    expect(incomeDays[2].date).toBe("2025-08-01");
  });

  it("advances quarterly expenses correctly", () => {
    const result = projectCashflow({
      startingBalance: 0,
      incomes: [],
      expenses: [
        { name: "Insurance", amount: 300_00, frequency: "quarterly", nextDueDate: "2025-06-15" },
      ],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 14,
    });

    const expenseDays = result.filter((d) => d.events.some((e) => e.type === "expense"));
    expect(expenseDays).toHaveLength(1); // only Jun 15 within 14 weeks
    expect(expenseDays[0].date).toBe("2025-06-15");
  });

  it("advances yearly expenses correctly", () => {
    const result = projectCashflow({
      startingBalance: 0,
      incomes: [],
      expenses: [
        { name: "Rego", amount: 800_00, frequency: "yearly", nextDueDate: "2025-06-10" },
      ],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 8,
    });

    const expenseDays = result.filter((d) => d.events.some((e) => e.type === "expense"));
    expect(expenseDays).toHaveLength(1);
    expect(expenseDays[0].date).toBe("2025-06-10");
  });
});

// ---------------------------------------------------------------------------
// getNextOccurrences (tested indirectly)
// ---------------------------------------------------------------------------
describe("getNextOccurrences (indirect)", () => {
  it("skips past dates and starts from the first occurrence >= today", () => {
    // nextPayDate is in the past; should advance to first occurrence on or after today
    const result = projectCashflow({
      startingBalance: 0,
      incomes: [
        { name: "Job", amount: 100_00, frequency: "weekly", nextPayDate: "2025-05-25" },
      ],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 2,
    });

    const incomeDays = result.filter((d) => d.events.some((e) => e.type === "income"));
    // May 25 -> advance weekly -> Jun 1 (today), Jun 8
    expect(incomeDays.length).toBeGreaterThanOrEqual(1);
    const firstIncomeDate = new Date(incomeDays[0].date);
    expect(firstIncomeDate.getTime()).toBeGreaterThanOrEqual(MOCK_TODAY.getTime());
  });

  it("includes the start date if it equals today", () => {
    const result = projectCashflow({
      startingBalance: 0,
      incomes: [
        { name: "Job", amount: 100_00, frequency: "monthly", nextPayDate: "2025-06-01" },
      ],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 2,
    });

    const incomeDays = result.filter((d) => d.events.some((e) => e.type === "income"));
    expect(incomeDays[0].date).toBe("2025-06-01");
  });
});

// ---------------------------------------------------------------------------
// projectCashflow
// ---------------------------------------------------------------------------
describe("projectCashflow", () => {
  it("returns correct number of days for default 8 weeks", () => {
    const result = projectCashflow({
      startingBalance: 1000_00,
      incomes: [],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
    });

    // 8 weeks = 56 days, plus today = 57 entries
    expect(result).toHaveLength(57);
  });

  it("returns correct number of days for custom weeksAhead", () => {
    const result = projectCashflow({
      startingBalance: 1000_00,
      incomes: [],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 2,
    });

    expect(result).toHaveLength(15); // 14 days + today
  });

  it("starts at startingBalance and stays flat with no events", () => {
    const result = projectCashflow({
      startingBalance: 5000_00,
      incomes: [],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 1,
    });

    for (const day of result) {
      expect(day.balance).toBe(5000_00);
      expect(day.events).toHaveLength(0);
    }
  });

  it("adds income and subtracts expenses correctly", () => {
    const result = projectCashflow({
      startingBalance: 1000_00,
      incomes: [
        { name: "Salary", amount: 2000_00, frequency: "weekly", nextPayDate: "2025-06-01" },
      ],
      expenses: [
        { name: "Rent", amount: 500_00, frequency: "weekly", nextDueDate: "2025-06-01" },
      ],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 1,
    });

    // Day 1 (Jun 1): 1000 + 2000 - 500 = 2500
    expect(result[0].balance).toBe(2500_00);
    expect(result[0].events).toHaveLength(2);

    // Day 8 (Jun 8): 2500 + 2000 - 500 = 4000
    expect(result[7].balance).toBe(4000_00);
  });

  it("handles BNPL payments with instalment limits", () => {
    const result = projectCashflow({
      startingBalance: 1000_00,
      incomes: [],
      expenses: [],
      bnplPayments: [
        {
          itemName: "Laptop",
          provider: "Afterpay",
          instalmentAmount: 100_00,
          instalmentFrequency: "weekly",
          instalmentsRemaining: 2,
          nextPaymentDate: "2025-06-01",
        },
      ],
      creditCards: [],
      weeksAhead: 4,
    });

    const bnplDays = result.filter((d) => d.events.some((e) => e.type === "bnpl"));
    // Only 2 instalments remaining, so only 2 payment events
    expect(bnplDays).toHaveLength(2);
    expect(bnplDays[0].date).toBe("2025-06-01");
    expect(bnplDays[1].date).toBe("2025-06-08");

    // Balance after 2 BNPL payments: 1000 - 100 - 100 = 800
    const lastBnplDay = result.findIndex((d) => d.date === "2025-06-08");
    expect(result[lastBnplDay].balance).toBe(800_00);
  });

  it("handles credit card minimum payments", () => {
    const result = projectCashflow({
      startingBalance: 5000_00,
      incomes: [],
      expenses: [],
      bnplPayments: [],
      creditCards: [
        { name: "Visa", balance: 2000_00, minimumPayment: 50_00, dueDate: 15 },
      ],
      weeksAhead: 8,
    });

    const ccDays = result.filter((d) => d.events.some((e) => e.type === "credit_card"));
    // Due on 15th: Jun 15, Jul 15 within 8 weeks from Jun 1
    expect(ccDays.length).toBeGreaterThanOrEqual(1);
    expect(ccDays[0].date).toBe("2025-06-15");

    // Check event description
    const ccEvent = ccDays[0].events.find((e) => e.type === "credit_card");
    expect(ccEvent?.description).toBe("Visa minimum payment");
    expect(ccEvent?.amount).toBe(-50_00);
  });

  it("skips credit card payments when balance is 0", () => {
    const result = projectCashflow({
      startingBalance: 5000_00,
      incomes: [],
      expenses: [],
      bnplPayments: [],
      creditCards: [
        { name: "Visa", balance: 0, minimumPayment: 50_00, dueDate: 15 },
      ],
      weeksAhead: 8,
    });

    const ccDays = result.filter((d) => d.events.some((e) => e.type === "credit_card"));
    expect(ccDays).toHaveLength(0);
  });

  it("skips credit card payments when minimumPayment is 0", () => {
    const result = projectCashflow({
      startingBalance: 5000_00,
      incomes: [],
      expenses: [],
      bnplPayments: [],
      creditCards: [
        { name: "Visa", balance: 2000_00, minimumPayment: 0, dueDate: 15 },
      ],
      weeksAhead: 8,
    });

    const ccDays = result.filter((d) => d.events.some((e) => e.type === "credit_card"));
    expect(ccDays).toHaveLength(0);
  });

  it("includes additionalEvents in the projection", () => {
    const result = projectCashflow({
      startingBalance: 1000_00,
      incomes: [],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
      additionalEvents: [
        {
          date: new Date(2025, 5, 5),
          description: "Tax refund",
          amount: 500_00,
          type: "income",
        },
      ],
      weeksAhead: 2,
    });

    const refundDay = result.find((d) => d.date === "2025-06-05");
    expect(refundDay?.events).toHaveLength(1);
    expect(refundDay?.events[0].description).toBe("Tax refund");
    expect(refundDay?.balance).toBe(1500_00);
  });

  it("handles multiple income and expense sources together", () => {
    const result = projectCashflow({
      startingBalance: 500_00,
      incomes: [
        { name: "Job1", amount: 1000_00, frequency: "weekly", nextPayDate: "2025-06-01" },
        { name: "Job2", amount: 500_00, frequency: "fortnightly", nextPayDate: "2025-06-01" },
      ],
      expenses: [
        { name: "Rent", amount: 300_00, frequency: "weekly", nextDueDate: "2025-06-01" },
        { name: "Phone", amount: 50_00, frequency: "monthly", nextDueDate: "2025-06-01" },
      ],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 1,
    });

    // Day 1: 500 + 1000 + 500 - 300 - 50 = 1650
    expect(result[0].balance).toBe(1650_00);
    expect(result[0].events).toHaveLength(4);
  });

  it("allows balance to go negative", () => {
    const result = projectCashflow({
      startingBalance: 100_00,
      incomes: [],
      expenses: [
        { name: "Bill", amount: 200_00, frequency: "weekly", nextDueDate: "2025-06-01" },
      ],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 1,
    });

    // Day 1: 100 - 200 = -100
    expect(result[0].balance).toBe(-100_00);
  });

  it("uses running balance across days", () => {
    const result = projectCashflow({
      startingBalance: 0,
      incomes: [
        { name: "Job", amount: 100_00, frequency: "weekly", nextPayDate: "2025-06-01" },
      ],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 3,
    });

    // After week 1: 100, after week 2: 200, after week 3: 300
    const week1 = result.find((d) => d.date === "2025-06-01");
    const week2 = result.find((d) => d.date === "2025-06-08");
    const week3 = result.find((d) => d.date === "2025-06-15");

    expect(week1?.balance).toBe(100_00);
    expect(week2?.balance).toBe(200_00);
    expect(week3?.balance).toBe(300_00);
  });
});

// ---------------------------------------------------------------------------
// calculateSafeToSpend
// ---------------------------------------------------------------------------
describe("calculateSafeToSpend", () => {
  it("returns balance minus upcoming expenses", () => {
    const result = calculateSafeToSpend({
      currentBalance: 2000_00,
      incomes: [
        { name: "Job", amount: 1500_00, frequency: "fortnightly", nextPayDate: "2025-06-15" },
      ],
      expenses: [
        { name: "Rent", amount: 500_00, frequency: "weekly", nextDueDate: "2025-06-01" },
      ],
      bnplPayments: [],
      creditCards: [],
    });

    // Next pay date is Jun 15. Expenses between Jun 1 and Jun 15 (inclusive):
    // Rent on Jun 1, Jun 8, Jun 15 = 500 * 3 = 1500
    expect(result.safeToSpend).toBe(500_00); // 2000 - 1500
    expect(result.nextPayDate).toBe("2025-06-15");
  });

  it("returns correct daysUntilPay", () => {
    const result = calculateSafeToSpend({
      currentBalance: 1000_00,
      incomes: [
        { name: "Job", amount: 1000_00, frequency: "monthly", nextPayDate: "2025-06-15" },
      ],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
    });

    // Today is Jun 1, next pay Jun 15 = 14 days
    expect(result.daysUntilPay).toBe(14);
    expect(result.nextPayDate).toBe("2025-06-15");
  });

  it("finds earliest next pay across multiple incomes", () => {
    const result = calculateSafeToSpend({
      currentBalance: 1000_00,
      incomes: [
        { name: "Job1", amount: 1000_00, frequency: "monthly", nextPayDate: "2025-06-20" },
        { name: "Job2", amount: 500_00, frequency: "weekly", nextPayDate: "2025-06-05" },
      ],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
    });

    // Job2 pays first: Jun 5, but need to advance past today (Jun 1)
    // Jun 5 is after today, so nextPayDate should be Jun 5
    expect(result.nextPayDate).toBe("2025-06-05");
    expect(result.daysUntilPay).toBe(4);
  });

  it("advances past income nextPayDate if it's today or earlier", () => {
    const result = calculateSafeToSpend({
      currentBalance: 1000_00,
      incomes: [
        { name: "Job", amount: 1000_00, frequency: "weekly", nextPayDate: "2025-06-01" },
      ],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
    });

    // nextPayDate is today (Jun 1), so advance to Jun 8
    expect(result.nextPayDate).toBe("2025-06-08");
    expect(result.daysUntilPay).toBe(7);
  });

  it("falls back to 14 days when no incomes provided", () => {
    const result = calculateSafeToSpend({
      currentBalance: 1000_00,
      incomes: [],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
    });

    const expected = fmtDate(addDays(MOCK_TODAY, 14));
    expect(result.nextPayDate).toBe(expected);
    expect(result.daysUntilPay).toBe(14);
    expect(result.safeToSpend).toBe(1000_00);
  });

  it("includes BNPL payments in upcoming expenses", () => {
    const result = calculateSafeToSpend({
      currentBalance: 2000_00,
      incomes: [
        { name: "Job", amount: 1000_00, frequency: "monthly", nextPayDate: "2025-06-15" },
      ],
      expenses: [],
      bnplPayments: [
        {
          itemName: "Phone",
          provider: "Afterpay",
          instalmentAmount: 100_00,
          instalmentFrequency: "weekly",
          instalmentsRemaining: 10,
          nextPaymentDate: "2025-06-01",
        },
      ],
      creditCards: [],
    });

    // BNPL weekly from Jun 1 to Jun 15 (inclusive): Jun 1, Jun 8, Jun 15 = 3 payments
    const bnplExpenses = result.upcomingExpenses.filter((e) =>
      e.name.includes("Afterpay")
    );
    expect(bnplExpenses).toHaveLength(3);
    expect(result.safeToSpend).toBe(1700_00); // 2000 - 300
  });

  it("respects BNPL instalmentsRemaining limit", () => {
    const result = calculateSafeToSpend({
      currentBalance: 2000_00,
      incomes: [
        { name: "Job", amount: 1000_00, frequency: "monthly", nextPayDate: "2025-06-15" },
      ],
      expenses: [],
      bnplPayments: [
        {
          itemName: "Phone",
          provider: "Afterpay",
          instalmentAmount: 100_00,
          instalmentFrequency: "weekly",
          instalmentsRemaining: 1,
          nextPaymentDate: "2025-06-01",
        },
      ],
      creditCards: [],
    });

    const bnplExpenses = result.upcomingExpenses.filter((e) =>
      e.name.includes("Afterpay")
    );
    expect(bnplExpenses).toHaveLength(1);
    expect(result.safeToSpend).toBe(1900_00);
  });

  it("includes credit card minimum payments in upcoming expenses", () => {
    const result = calculateSafeToSpend({
      currentBalance: 2000_00,
      incomes: [
        { name: "Job", amount: 1000_00, frequency: "monthly", nextPayDate: "2025-06-20" },
      ],
      expenses: [],
      bnplPayments: [],
      creditCards: [
        { name: "Visa", balance: 5000_00, minimumPayment: 150_00, dueDate: 15 },
      ],
    });

    const ccExpenses = result.upcomingExpenses.filter((e) =>
      e.name.includes("Visa")
    );
    expect(ccExpenses).toHaveLength(1);
    expect(ccExpenses[0].amount).toBe(150_00);
    expect(result.safeToSpend).toBe(1850_00);
  });

  it("sorts upcoming expenses by date", () => {
    const result = calculateSafeToSpend({
      currentBalance: 5000_00,
      incomes: [
        { name: "Job", amount: 2000_00, frequency: "monthly", nextPayDate: "2025-06-30" },
      ],
      expenses: [
        { name: "Rent", amount: 500_00, frequency: "monthly", nextDueDate: "2025-06-15" },
        { name: "Internet", amount: 80_00, frequency: "monthly", nextDueDate: "2025-06-05" },
      ],
      bnplPayments: [],
      creditCards: [],
    });

    expect(result.upcomingExpenses[0].name).toBe("Internet");
    expect(result.upcomingExpenses[1].name).toBe("Rent");
  });

  it("returns negative safeToSpend when expenses exceed balance", () => {
    const result = calculateSafeToSpend({
      currentBalance: 100_00,
      incomes: [
        { name: "Job", amount: 1000_00, frequency: "monthly", nextPayDate: "2025-06-30" },
      ],
      expenses: [
        { name: "Rent", amount: 500_00, frequency: "monthly", nextDueDate: "2025-06-15" },
      ],
      bnplPayments: [],
      creditCards: [],
    });

    expect(result.safeToSpend).toBe(-400_00); // 100 - 500
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe("edge cases", () => {
  it("handles empty inputs gracefully", () => {
    const result = projectCashflow({
      startingBalance: 0,
      incomes: [],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 1,
    });

    expect(result).toHaveLength(8); // 7 days + today
    for (const day of result) {
      expect(day.balance).toBe(0);
      expect(day.events).toHaveLength(0);
    }
  });

  it("handles zero starting balance", () => {
    const result = projectCashflow({
      startingBalance: 0,
      incomes: [
        { name: "Job", amount: 100_00, frequency: "weekly", nextPayDate: "2025-06-01" },
      ],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 1,
    });

    expect(result[0].balance).toBe(100_00);
  });

  it("handles negative starting balance", () => {
    const result = projectCashflow({
      startingBalance: -500_00,
      incomes: [
        { name: "Job", amount: 1000_00, frequency: "weekly", nextPayDate: "2025-06-01" },
      ],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 1,
    });

    expect(result[0].balance).toBe(500_00); // -500 + 1000
  });

  it("handles multiple events on the same day", () => {
    const result = projectCashflow({
      startingBalance: 1000_00,
      incomes: [
        { name: "Job1", amount: 500_00, frequency: "weekly", nextPayDate: "2025-06-01" },
        { name: "Job2", amount: 300_00, frequency: "weekly", nextPayDate: "2025-06-01" },
      ],
      expenses: [
        { name: "Rent", amount: 200_00, frequency: "weekly", nextDueDate: "2025-06-01" },
      ],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 1,
    });

    // Day 1: 1000 + 500 + 300 - 200 = 1600
    expect(result[0].events).toHaveLength(3);
    expect(result[0].balance).toBe(1600_00);
  });

  it("BNPL with 0 instalments remaining produces no events", () => {
    const result = projectCashflow({
      startingBalance: 1000_00,
      incomes: [],
      expenses: [],
      bnplPayments: [
        {
          itemName: "Phone",
          provider: "Afterpay",
          instalmentAmount: 100_00,
          instalmentFrequency: "weekly",
          instalmentsRemaining: 0,
          nextPaymentDate: "2025-06-01",
        },
      ],
      creditCards: [],
      weeksAhead: 4,
    });

    const bnplDays = result.filter((d) => d.events.some((e) => e.type === "bnpl"));
    expect(bnplDays).toHaveLength(0);
  });

  it("weeksAhead of 0 returns just today", () => {
    const result = projectCashflow({
      startingBalance: 1000_00,
      incomes: [],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2025-06-01");
  });

  it("dates are formatted as YYYY-MM-DD", () => {
    const result = projectCashflow({
      startingBalance: 0,
      incomes: [],
      expenses: [],
      bnplPayments: [],
      creditCards: [],
      weeksAhead: 1,
    });

    for (const day of result) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
