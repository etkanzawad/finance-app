import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: incomes } = await supabase.from("income").select("*");
  if (!incomes) return [];

  const processed: string[] = [];

  for (const inc of incomes) {
    // Skip if no account linked
    if (!inc.account_id) continue;

    // Skip if nextPayDate is in the future
    if (inc.next_pay_date > today) continue;

    // Skip if we already processed this exact date
    if (inc.last_processed_date === inc.next_pay_date) {
      // Date already processed but nextPayDate wasn't advanced (shouldn't happen, but safety check)
      // Advance it now
      const newNextDate = advanceDate(inc.next_pay_date, inc.frequency);
      await supabase
        .from("income")
        .update({ next_pay_date: newNextDate })
        .eq("id", inc.id);
      continue;
    }

    // Process all missed pay dates up to today (handles catching up if app wasn't opened for a while)
    let currentPayDate = inc.next_pay_date;
    while (currentPayDate <= today) {
      // Credit the bank account (atomic increment via RPC)
      await supabase.rpc("increment_balance", {
        account_id_param: inc.account_id,
        amount_param: inc.amount,
      });

      // Create a transaction record
      await supabase.from("transactions").insert({
        account_id: inc.account_id,
        date: currentPayDate,
        raw_description: `Income: ${inc.name}`,
        clean_description: inc.name,
        amount: inc.amount,
        category: "Income",
        is_income: true,
        is_reviewed: true,
        statement_month: currentPayDate.substring(0, 7),
      });

      processed.push(`${inc.name} on ${currentPayDate}`);

      // Advance to next pay date
      currentPayDate = advanceDate(currentPayDate, inc.frequency);
    }

    // Update the income record with next pay date and last processed marker
    await supabase
      .from("income")
      .update({
        next_pay_date: currentPayDate,
        last_processed_date: today,
      })
      .eq("id", inc.id);
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
