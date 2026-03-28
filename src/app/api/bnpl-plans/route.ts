import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { toCamel } from "@/lib/db/camel";

function advanceDate(dateStr: string, frequency: string): string {
  const date = new Date(dateStr + "T00:00:00");
  switch (frequency) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "fortnightly":
      date.setDate(date.getDate() + 14);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
  }
  return date.toISOString().split("T")[0];
}

export async function GET() {
  const supabase = await createClient();

  const { data: plansRaw, error } = await supabase
    .from("bnpl_plans")
    .select("*, bnpl_accounts!inner(*)")
    .order("next_payment_date", { ascending: true });

  if (error) throw error;

  // Flatten the joined data
  const plans = plansRaw.map((p: any) => ({
    id: p.id,
    bnplAccountId: p.bnpl_account_id,
    itemName: p.item_name,
    totalAmount: p.total_amount,
    instalmentAmount: p.instalment_amount,
    instalmentFrequency: p.instalment_frequency,
    instalmentsTotal: p.instalments_total,
    instalmentsRemaining: p.instalments_remaining,
    nextPaymentDate: p.next_payment_date,
    createdAt: p.created_at,
    provider: p.bnpl_accounts.provider,
    spendingLimit: p.bnpl_accounts.spending_limit,
    availableLimit: p.bnpl_accounts.available_limit,
  }));

  // Auto-advance plans whose payment date has passed
  const today = new Date().toISOString().split("T")[0];

  for (const plan of plans) {
    let remaining = plan.instalmentsRemaining;
    let nextDate = plan.nextPaymentDate;
    let changed = false;

    while (nextDate <= today && remaining > 0) {
      remaining--;
      changed = true;
      if (remaining === 0) break;
      nextDate = advanceDate(nextDate, plan.instalmentFrequency);
    }

    if (changed) {
      if (remaining === 0) {
        // Fully paid off — remove the plan
        const { error: deleteError } = await supabase
          .from("bnpl_plans")
          .delete()
          .eq("id", plan.id);
        if (deleteError) throw deleteError;
      } else {
        // Update with new remaining count and next date
        const { error: updateError } = await supabase
          .from("bnpl_plans")
          .update({
            instalments_remaining: remaining,
            next_payment_date: nextDate,
          })
          .eq("id", plan.id);
        if (updateError) throw updateError;
      }
      // Update in-memory for the response
      plan.instalmentsRemaining = remaining;
      plan.nextPaymentDate = nextDate;
    }
  }

  // Filter out completed plans from response
  const activePlans = plans.filter((p: any) => p.instalmentsRemaining > 0);

  return NextResponse.json(activePlans);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from("bnpl_plans")
    .insert({
      bnpl_account_id: body.bnplAccountId,
      item_name: body.itemName,
      total_amount: body.totalAmount,
      instalment_amount: body.instalmentAmount,
      instalment_frequency: body.instalmentFrequency,
      instalments_total: body.instalmentsTotal,
      instalments_remaining: body.instalmentsRemaining,
      next_payment_date: body.nextPaymentDate,
    })
    .select()
    .single();

  if (error) throw error;

  return NextResponse.json(toCamel(data), { status: 201 });
}
