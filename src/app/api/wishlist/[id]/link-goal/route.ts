import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { toCamel } from "@/lib/db/camel";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const itemId = Number(id);
  const supabase = await createClient();

  // Get the wishlist item
  const { data: items, error: fetchError } = await supabase
    .from('wishlist_items')
    .select('*')
    .eq('id', itemId);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Wishlist item not found" }, { status: 404 });
  }

  const item = items[0];
  let goalId: number;

  if (body.existingGoalId) {
    goalId = body.existingGoalId;
  } else {
    // Create a new savings goal from the wishlist item
    const { data: newGoals, error: insertError } = await supabase
      .from('savings_goals')
      .insert({
        name: item.name,
        target_amount: item.price,
        current_amount: 0,
        priority: item.priority,
      })
      .select();

    if (insertError || !newGoals || newGoals.length === 0) {
      return NextResponse.json({ error: insertError?.message || "Failed to create goal" }, { status: 500 });
    }
    goalId = newGoals[0].id;
  }

  // Link the goal and set status to saving
  const { data: updated, error: updateError } = await supabase
    .from('wishlist_items')
    .update({
      linked_goal_id: goalId,
      status: "saving",
    })
    .eq('id', itemId)
    .select();

  if (updateError || !updated || updated.length === 0) {
    return NextResponse.json({ error: updateError?.message || "Failed to update item" }, { status: 500 });
  }

  return NextResponse.json(toCamel(updated[0]));
}
