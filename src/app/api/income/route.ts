import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { toCamel } from "@/lib/db/camel";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('income')
    .select('*')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(toCamel(data));
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase
    .from('income')
    .insert({
      name: body.name,
      amount: body.amount,
      frequency: body.frequency,
      next_pay_date: body.nextPayDate,
      account_id: body.accountId || null,
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

  const updateData: Record<string, unknown> = {
    name: body.name,
    amount: body.amount,
    frequency: body.frequency,
    next_pay_date: body.nextPayDate,
  };
  if (body.accountId !== undefined) {
    updateData.account_id = body.accountId;
  }

  const { data, error } = await supabase
    .from('income')
    .update(updateData)
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
    .from('income')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
