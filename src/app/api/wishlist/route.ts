import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { toCamel } from "@/lib/db/camel";

export async function GET() {
  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from("wishlist_items")
    .select("*, savings_goals(*)")
    .order("priority", { ascending: true });

  if (error) throw error;

  // Flatten the joined data to match the previous shape
  const flatItems = items.map((i: any) => ({
    id: i.id,
    name: i.name,
    price: i.price,
    url: i.url,
    store: i.store,
    priority: i.priority,
    notes: i.notes,
    category: i.category,
    status: i.status,
    linkedGoalId: i.linked_goal_id,
    dateAdded: i.date_added,
    datePurchased: i.date_purchased,
    createdAt: i.created_at,
    goalName: i.savings_goals?.name ?? null,
    goalCurrentAmount: i.savings_goals?.current_amount ?? null,
    goalTargetAmount: i.savings_goals?.target_amount ?? null,
  }));

  return NextResponse.json(flatItems);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from("wishlist_items")
    .insert({
      name: body.name,
      price: body.price,
      url: body.url ?? null,
      store: body.store ?? null,
      priority: body.priority ?? 3,
      notes: body.notes ?? null,
      category: body.category ?? null,
      status: "wanted",
      date_added: format(new Date(), "yyyy-MM-dd"),
    })
    .select()
    .single();

  if (error) throw error;

  return NextResponse.json(toCamel(data), { status: 201 });
}
