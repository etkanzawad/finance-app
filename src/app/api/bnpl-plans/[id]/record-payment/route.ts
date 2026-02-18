import { db } from "@/lib/db";
import { bnplPlans } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { addWeeks, addMonths, format } from "date-fns";

function advanceDate(dateStr: string, frequency: string): string {
  // Parse as local midnight to avoid UTC offset shifting the date
  const date = new Date(dateStr + "T00:00:00");
  switch (frequency) {
    case "weekly":
      return format(addWeeks(date, 1), "yyyy-MM-dd");
    case "fortnightly":
      return format(addWeeks(date, 2), "yyyy-MM-dd");
    case "monthly":
      return format(addMonths(date, 1), "yyyy-MM-dd");
    default:
      return format(addMonths(date, 1), "yyyy-MM-dd");
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const planId = Number(id);

  const [plan] = await db
    .select()
    .from(bnplPlans)
    .where(eq(bnplPlans.id, planId));

  if (!plan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (plan.instalmentsRemaining <= 0) {
    return NextResponse.json(
      { error: "No remaining instalments" },
      { status: 400 }
    );
  }

  const newRemaining = plan.instalmentsRemaining - 1;

  if (newRemaining === 0) {
    // Fully paid — delete the plan
    await db.delete(bnplPlans).where(eq(bnplPlans.id, planId));
    return NextResponse.json({ completed: true });
  }

  const newNextDate = advanceDate(
    plan.nextPaymentDate,
    plan.instalmentFrequency
  );

  const [updated] = await db
    .update(bnplPlans)
    .set({
      instalmentsRemaining: newRemaining,
      nextPaymentDate: newNextDate,
    })
    .where(eq(bnplPlans.id, planId))
    .returning();

  return NextResponse.json(updated);
}
