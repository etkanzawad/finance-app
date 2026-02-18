import { db } from "@/lib/db";
import { wishlistItems, savingsGoals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const itemId = Number(id);

  // Get the wishlist item
  const [item] = await db
    .select()
    .from(wishlistItems)
    .where(eq(wishlistItems.id, itemId));

  if (!item) {
    return NextResponse.json({ error: "Wishlist item not found" }, { status: 404 });
  }

  let goalId: number;

  if (body.existingGoalId) {
    goalId = body.existingGoalId;
  } else {
    // Create a new savings goal from the wishlist item
    const [newGoal] = await db
      .insert(savingsGoals)
      .values({
        name: item.name,
        targetAmount: item.price,
        currentAmount: 0,
        priority: item.priority,
      })
      .returning();
    goalId = newGoal.id;
  }

  // Link the goal and set status to saving
  const [updated] = await db
    .update(wishlistItems)
    .set({
      linkedGoalId: goalId,
      status: "saving",
    })
    .where(eq(wishlistItems.id, itemId))
    .returning();

  return NextResponse.json(updated);
}
