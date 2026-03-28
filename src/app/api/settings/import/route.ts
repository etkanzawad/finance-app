import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const data = await req.json();

    if (!data.version || !data.exportDate) {
      return NextResponse.json({ error: "Invalid backup file format" }, { status: 400 });
    }

    // Clear existing data first
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

    // Import data
    if (data.income?.length) {
      const { error } = await supabase.from('income').insert(data.income);
      if (error) throw error;
    }
    if (data.accounts?.length) {
      const { error } = await supabase.from('accounts').insert(data.accounts);
      if (error) throw error;
    }
    if (data.bnplAccounts?.length) {
      const { error } = await supabase.from('bnpl_accounts').insert(data.bnplAccounts);
      if (error) throw error;
    }
    if (data.bnplPlans?.length) {
      const { error } = await supabase.from('bnpl_plans').insert(data.bnplPlans);
      if (error) throw error;
    }
    if (data.fixedExpenses?.length) {
      const { error } = await supabase.from('fixed_expenses').insert(data.fixedExpenses);
      if (error) throw error;
    }
    if (data.transactions?.length) {
      const { error } = await supabase.from('transactions').insert(data.transactions);
      if (error) throw error;
    }
    if (data.savingsGoals?.length) {
      const { error } = await supabase.from('savings_goals').insert(data.savingsGoals);
      if (error) throw error;
    }
    if (data.merchantMappings?.length) {
      const { error } = await supabase.from('merchant_mappings').insert(data.merchantMappings);
      if (error) throw error;
    }
    if (data.settings?.length) {
      const { error } = await supabase.from('settings').insert(data.settings);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to import data" }, { status: 500 });
  }
}
