import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { addWeeks, addMonths, format } from "date-fns";
import { toCamel } from "@/lib/db/camel";

function advanceDate(dateStr: string, frequency: string): string {
  // Parse as local midnight to avoid UTC offset shifting the date
  const date = new Date(dateStr + "T00:00:00");
  switch (frequency) {
    case "weekly":
      return format(addWeeks(date, 1), "yyyy-MM-dd");
    case "fortnightly":
      return format(addWeeks(date, 2), "yyyy-MM-dd");
    case "monthly":
      return format(addMonths(date, 1), "yyyy-MM-dd");
    default:
      return format(addMonths(date, 1), "yyyy-MM-dd");
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  const planId = Number(id);

  const { data: planData, error: fetchError } = await supabase
    .from('bnpl_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (fetchError || !planData) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (planData.instalments_remaining <= 0) {
    return NextResponse.json(
      { error: "No remaining instalments" },
      { status: 400 }
    );
  }

  const newRemaining = planData.instalments_remaining - 1;

  if (newRemaining === 0) {
    // Fully paid — delete the plan
    const { error: deleteError } = await supabase
      .from('bnpl_plans')
      .delete()
      .eq('id', planId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    return NextResponse.json({ completed: true });
  }

  const newNextDate = advanceDate(
    planData.next_payment_date,
    planData.instalment_frequency
  );

  const { data: updated, error: updateError } = await supabase
    .from('bnpl_plans')
    .update({
      instalments_remaining: newRemaining,
      next_payment_date: newNextDate,
    })
    .eq('id', planId)
    .select();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json(toCamel(updated![0]));
}
