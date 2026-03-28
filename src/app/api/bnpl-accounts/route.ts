import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { toCamel } from "@/lib/db/camel";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bnpl_accounts')
    .select('*')
    .order('provider');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(toCamel(data));
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase
    .from('bnpl_accounts')
    .insert({
      provider: body.provider,
      spending_limit: body.spendingLimit,
      available_limit: body.availableLimit,
      late_fee_amount: body.lateFeeAmount ?? null,
      is_active: body.isActive ?? true,
      notes: body.notes ?? null,
    })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(toCamel(data[0]), { status: 201 });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase
    .from('bnpl_accounts')
    .update({
      provider: body.provider,
      spending_limit: body.spendingLimit,
      available_limit: body.availableLimit,
      late_fee_amount: body.lateFeeAmount ?? null,
      is_active: body.isActive,
      notes: body.notes ?? null,
    })
    .eq('id', body.id)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(toCamel(data[0]));
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const { error } = await supabase
    .from('bnpl_accounts')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
