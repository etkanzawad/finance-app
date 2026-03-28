import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();

  const { error: e1 } = await supabase.from('transactions').delete().gte('id', 0);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('bnpl_plans').delete().gte('id', 0);
  if (e2) throw e2;
  const { error: e3 } = await supabase.from('bnpl_accounts').delete().gte('id', 0);
  if (e3) throw e3;
  const { error: e4 } = await supabase.from('income').delete().gte('id', 0);
  if (e4) throw e4;
  const { error: e5 } = await supabase.from('accounts').delete().gte('id', 0);
  if (e5) throw e5;
  const { error: e6 } = await supabase.from('fixed_expenses').delete().gte('id', 0);
  if (e6) throw e6;
  const { error: e7 } = await supabase.from('savings_goals').delete().gte('id', 0);
  if (e7) throw e7;
  const { error: e8 } = await supabase.from('merchant_mappings').delete().gte('id', 0);
  if (e8) throw e8;
  const { error: e9 } = await supabase.from('settings').delete().gte('id', 0);
  if (e9) throw e9;

  return NextResponse.json({ success: true });
}
