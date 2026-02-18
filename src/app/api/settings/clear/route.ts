import { db } from "@/lib/db";
import { income, accounts, bnplAccounts, bnplPlans, fixedExpenses, transactions, savingsGoals, merchantMappings, settings } from "@/lib/db/schema";
import { NextResponse } from "next/server";

export async function POST() {
  await db.delete(transactions);
  await db.delete(bnplPlans);
  await db.delete(bnplAccounts);
  await db.delete(income);
  await db.delete(accounts);
  await db.delete(fixedExpenses);
  await db.delete(savingsGoals);
  await db.delete(merchantMappings);
  await db.delete(settings);

  return NextResponse.json({ success: true });
}
