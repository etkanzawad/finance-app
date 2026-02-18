import { db } from "@/lib/db";
import { savingsGoals } from "@/lib/db/schema";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const goals = await db
    .select()
    .from(savingsGoals)
    .orderBy(savingsGoals.priority);
  return NextResponse.json(goals);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await db
    .insert(savingsGoals)
    .values({
      name: body.name,
      targetAmount: body.targetAmount,
      currentAmount: body.currentAmount ?? 0,
      deadline: body.deadline ?? null,
      priority: body.priority ?? 3,
    })
    .returning();
  return NextResponse.json(result[0], { status: 201 });
}
