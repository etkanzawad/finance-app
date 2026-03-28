import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { toCamel } from "@/lib/db/camel";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await req.json();
  const { data, error } = await supabase
    .from('bnpl_plans')
    .update({
      item_name: body.itemName,
      total_amount: body.totalAmount,
      instalment_amount: body.instalmentAmount,
      instalment_frequency: body.instalmentFrequency,
      instalments_total: body.instalmentsTotal,
      instalments_remaining: body.instalmentsRemaining,
      next_payment_date: body.nextPaymentDate,
    })
    .eq('id', Number(id))
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(toCamel(data[0]));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  const { error } = await supabase
    .from('bnpl_plans')
    .delete()
    .eq('id', Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
