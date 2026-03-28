import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { toCamel } from "@/lib/db/camel";

export async function GET() {
  const supabase = await createClient();

  const { data: incomeData, error: e1 } = await supabase.from('income').select('*');
  if (e1) throw e1;
  const { data: accountsData, error: e2 } = await supabase.from('accounts').select('*');
  if (e2) throw e2;
  const { data: bnplAccountsData, error: e3 } = await supabase.from('bnpl_accounts').select('*');
  if (e3) throw e3;
  const { data: bnplPlansData, error: e4 } = await supabase.from('bnpl_plans').select('*');
  if (e4) throw e4;
  const { data: fixedExpensesData, error: e5 } = await supabase.from('fixed_expenses').select('*');
  if (e5) throw e5;
  const { data: transactionsData, error: e6 } = await supabase.from('transactions').select('*');
  if (e6) throw e6;
  const { data: savingsGoalsData, error: e7 } = await supabase.from('savings_goals').select('*');
  if (e7) throw e7;
  const { data: merchantMappingsData, error: e8 } = await supabase.from('merchant_mappings').select('*');
  if (e8) throw e8;
  const { data: settingsData, error: e9 } = await supabase.from('settings').select('*');
  if (e9) throw e9;

  const data = {
    exportDate: new Date().toISOString(),
    version: 1,
    income: toCamel(incomeData),
    accounts: toCamel(accountsData),
    bnplAccounts: toCamel(bnplAccountsData),
    bnplPlans: toCamel(bnplPlansData),
    fixedExpenses: toCamel(fixedExpensesData),
    transactions: toCamel(transactionsData),
    savingsGoals: toCamel(savingsGoalsData),
    merchantMappings: toCamel(merchantMappingsData),
    settings: settingsData,
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="finance-backup-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
