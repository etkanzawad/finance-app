import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { toCamel } from "@/lib/db/camel";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const supabase = await createClient();

  const updates: Record<string, unknown> = {
    name: body.name,
    price: body.price,
    url: body.url ?? null,
    store: body.store ?? null,
    priority: body.priority,
    notes: body.notes ?? null,
    category: body.category ?? null,
  };

  if (body.status) {
    updates.status = body.status;
    if (body.status === "purchased") {
      updates.date_purchased = format(new Date(), "yyyy-MM-dd");
    }
  }

  if (body.linkedGoalId !== undefined) {
    updates.linked_goal_id = body.linkedGoalId;
  }

  const { data, error } = await supabase
    .from('wishlist_items')
    .update(updates)
    .eq('id', Number(id))
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(toCamel(data[0]));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from('wishlist_items')
    .delete()
    .eq('id', Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
