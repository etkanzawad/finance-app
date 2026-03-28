import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCamel } from "@/lib/db/camel";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const month = params.get("month");
  const category = params.get("category");
  const accountId = params.get("accountId");
  const search = params.get("search");
  const reviewed = params.get("reviewed");

  const supabase = await createClient();

  let query = supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });

  if (month) {
    query = query.eq('statement_month', month);
  }
  if (category) {
    query = query.eq('category', category);
  }
  if (accountId) {
    query = query.eq('account_id', Number(accountId));
  }
  if (search) {
    query = query.ilike('clean_description', `%${search}%`);
  }
  if (reviewed === "true") {
    query = query.eq('is_reviewed', true);
  } else if (reviewed === "false") {
    query = query.eq('is_reviewed', false);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(toCamel(data));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { transactions: txns } = body as {
    transactions: Record<string, unknown>[];
  };

  if (!txns || !Array.isArray(txns) || txns.length === 0) {
    return NextResponse.json(
      { error: "transactions array required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const inserted = [];
  for (const tx of txns) {
    const { data, error } = await supabase
      .from('transactions')
      .insert(tx)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    inserted.push(data![0]);
  }

  return NextResponse.json({ inserted: inserted.length, transactions: toCamel(inserted) });
}
