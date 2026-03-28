import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { toCamel } from "@/lib/db/camel";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .order('priority');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(toCamel(data));
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase
    .from('savings_goals')
    .insert({
      name: body.name,
      target_amount: body.targetAmount,
      current_amount: body.currentAmount ?? 0,
      deadline: body.deadline ?? null,
      priority: body.priority ?? 3,
    })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(toCamel(data[0]), { status: 201 });
}
