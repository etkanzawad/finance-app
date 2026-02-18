import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, like, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const month = params.get("month");
  const category = params.get("category");
  const accountId = params.get("accountId");
  const search = params.get("search");
  const reviewed = params.get("reviewed");

  const conditions = [];

  if (month) {
    conditions.push(eq(schema.transactions.statementMonth, month));
  }
  if (category) {
    conditions.push(eq(schema.transactions.category, category));
  }
  if (accountId) {
    conditions.push(eq(schema.transactions.accountId, Number(accountId)));
  }
  if (search) {
    conditions.push(like(schema.transactions.cleanDescription, `%${search}%`));
  }
  if (reviewed === "true") {
    conditions.push(eq(schema.transactions.isReviewed, true));
  } else if (reviewed === "false") {
    conditions.push(eq(schema.transactions.isReviewed, false));
  }

  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(schema.transactions)
          .where(and(...conditions))
          .orderBy(desc(schema.transactions.date))
      : await db
          .select()
          .from(schema.transactions)
          .orderBy(desc(schema.transactions.date));

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { transactions: txns } = body as {
    transactions: (typeof schema.transactions.$inferInsert)[];
  };

  if (!txns || !Array.isArray(txns) || txns.length === 0) {
    return NextResponse.json(
      { error: "transactions array required" },
      { status: 400 }
    );
  }

  const inserted = [];
  for (const tx of txns) {
    const result = await db
      .insert(schema.transactions)
      .values(tx)
      .returning();
    inserted.push(result[0]);
  }

  return NextResponse.json({ inserted: inserted.length, transactions: inserted });
}
