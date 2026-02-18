import { db } from "@/lib/db";
import { wishlistItems, savingsGoals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";

export async function GET() {
  const items = await db
    .select({
      id: wishlistItems.id,
      name: wishlistItems.name,
      price: wishlistItems.price,
      url: wishlistItems.url,
      store: wishlistItems.store,
      priority: wishlistItems.priority,
      notes: wishlistItems.notes,
      category: wishlistItems.category,
      status: wishlistItems.status,
      linkedGoalId: wishlistItems.linkedGoalId,
      dateAdded: wishlistItems.dateAdded,
      datePurchased: wishlistItems.datePurchased,
      createdAt: wishlistItems.createdAt,
      goalName: savingsGoals.name,
      goalCurrentAmount: savingsGoals.currentAmount,
      goalTargetAmount: savingsGoals.targetAmount,
    })
    .from(wishlistItems)
    .leftJoin(savingsGoals, eq(wishlistItems.linkedGoalId, savingsGoals.id))
    .orderBy(wishlistItems.priority);

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await db
    .insert(wishlistItems)
    .values({
      name: body.name,
      price: body.price,
      url: body.url ?? null,
      store: body.store ?? null,
      priority: body.priority ?? 3,
      notes: body.notes ?? null,
      category: body.category ?? null,
      status: "wanted",
      dateAdded: format(new Date(), "yyyy-MM-dd"),
    })
    .returning();
  return NextResponse.json(result[0], { status: 201 });
}
