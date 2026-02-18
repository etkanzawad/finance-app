import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { format, addMonths, addWeeks } from "date-fns";

/**
 * Processes any due income payments: credits the linked bank account,
 * creates a transaction record, and advances nextPayDate.
 * Runs automatically on dashboard load.
 *
 * A module-level promise prevents concurrent dashboard requests from
 * double-crediting income if multiple requests arrive simultaneously.
 */
let _inFlight: Promise<string[]> | null = null;

export function processIncome(): Promise<string[]> {
  if (_inFlight) return _inFlight;
  _inFlight = _processIncome().finally(() => {
    _inFlight = null;
  });
  return _inFlight;
}

async function _processIncome(): Promise<string[]> {
  const today = format(new Date(), "yyyy-MM-dd");

  const incomes = await db.select().from(schema.income);
  const processed: string[] = [];

  for (const inc of incomes) {
    // Skip if no account linked
    if (!inc.accountId) continue;

    // Skip if nextPayDate is in the future
    if (inc.nextPayDate > today) continue;

    // Skip if we already processed this exact date
    if (inc.lastProcessedDate === inc.nextPayDate) {
      // Date already processed but nextPayDate wasn't advanced (shouldn't happen, but safety check)
      // Advance it now
      const newNextDate = advanceDate(inc.nextPayDate, inc.frequency);
      await db
        .update(schema.income)
        .set({ nextPayDate: newNextDate })
        .where(eq(schema.income.id, inc.id));
      continue;
    }

    // Process all missed pay dates up to today (handles catching up if app wasn't opened for a while)
    let currentPayDate = inc.nextPayDate;
    while (currentPayDate <= today) {
      // Credit the bank account
      await db
        .update(schema.accounts)
        .set({
          balance: sql`${schema.accounts.balance} + ${inc.amount}`,
        })
        .where(eq(schema.accounts.id, inc.accountId));

      // Create a transaction record
      await db.insert(schema.transactions).values({
        accountId: inc.accountId,
        date: currentPayDate,
        rawDescription: `Income: ${inc.name}`,
        cleanDescription: inc.name,
        amount: inc.amount,
        category: "Income",
        isIncome: true,
        isReviewed: true,
        statementMonth: currentPayDate.substring(0, 7),
      });

      processed.push(`${inc.name} on ${currentPayDate}`);

      // Advance to next pay date
      currentPayDate = advanceDate(currentPayDate, inc.frequency);
    }

    // Update the income record with next pay date and last processed marker
    await db
      .update(schema.income)
      .set({
        nextPayDate: currentPayDate,
        lastProcessedDate: today,
      })
      .where(eq(schema.income.id, inc.id));
  }

  return processed;
}

function advanceDate(
  dateStr: string,
  frequency: string
): string {
  const date = new Date(dateStr + "T00:00:00");
  let next: Date;
  switch (frequency) {
    case "weekly":
      next = addWeeks(date, 1);
      break;
    case "fortnightly":
      next = addWeeks(date, 2);
      break;
    case "monthly":
      next = addMonths(date, 1);
      break;
    default:
      next = addMonths(date, 1);
  }
  return format(next, "yyyy-MM-dd");
}
