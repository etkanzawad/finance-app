import { db } from "@/lib/db";
import { income, accounts, bnplAccounts, bnplPlans, fixedExpenses, transactions, savingsGoals, merchantMappings, settings } from "@/lib/db/schema";
import { NextResponse } from "next/server";

export async function GET() {
  const data = {
    exportDate: new Date().toISOString(),
    version: 1,
    income: await db.select().from(income),
    accounts: await db.select().from(accounts),
    bnplAccounts: await db.select().from(bnplAccounts),
    bnplPlans: await db.select().from(bnplPlans),
    fixedExpenses: await db.select().from(fixedExpenses),
    transactions: await db.select().from(transactions),
    savingsGoals: await db.select().from(savingsGoals),
    merchantMappings: await db.select().from(merchantMappings),
    settings: await db.select().from(settings),
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="finance-backup-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
