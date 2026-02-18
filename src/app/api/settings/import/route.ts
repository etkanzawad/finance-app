import { db } from "@/lib/db";
import { income, accounts, bnplAccounts, bnplPlans, fixedExpenses, transactions, savingsGoals, merchantMappings, settings } from "@/lib/db/schema";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    if (!data.version || !data.exportDate) {
      return NextResponse.json({ error: "Invalid backup file format" }, { status: 400 });
    }

    // Clear existing data first
    await db.delete(transactions);
    await db.delete(bnplPlans);
    await db.delete(bnplAccounts);
    await db.delete(income);
    await db.delete(accounts);
    await db.delete(fixedExpenses);
    await db.delete(savingsGoals);
    await db.delete(merchantMappings);
    await db.delete(settings);

    // Import data
    if (data.income?.length) {
      await db.insert(income).values(data.income);
    }
    if (data.accounts?.length) {
      await db.insert(accounts).values(data.accounts);
    }
    if (data.bnplAccounts?.length) {
      await db.insert(bnplAccounts).values(data.bnplAccounts);
    }
    if (data.bnplPlans?.length) {
      await db.insert(bnplPlans).values(data.bnplPlans);
    }
    if (data.fixedExpenses?.length) {
      await db.insert(fixedExpenses).values(data.fixedExpenses);
    }
    if (data.transactions?.length) {
      await db.insert(transactions).values(data.transactions);
    }
    if (data.savingsGoals?.length) {
      await db.insert(savingsGoals).values(data.savingsGoals);
    }
    if (data.merchantMappings?.length) {
      await db.insert(merchantMappings).values(data.merchantMappings);
    }
    if (data.settings?.length) {
      await db.insert(settings).values(data.settings);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to import data" }, { status: 500 });
  }
}
