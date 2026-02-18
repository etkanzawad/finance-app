import { db } from "@/lib/db";
import { bnplPlans, bnplAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function advanceDate(dateStr: string, frequency: string): string {
  const date = new Date(dateStr + "T00:00:00");
  switch (frequency) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "fortnightly":
      date.setDate(date.getDate() + 14);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
  }
  return date.toISOString().split("T")[0];
}

export async function GET() {
  const plans = await db
    .select({
      id: bnplPlans.id,
      bnplAccountId: bnplPlans.bnplAccountId,
      itemName: bnplPlans.itemName,
      totalAmount: bnplPlans.totalAmount,
      instalmentAmount: bnplPlans.instalmentAmount,
      instalmentFrequency: bnplPlans.instalmentFrequency,
      instalmentsTotal: bnplPlans.instalmentsTotal,
      instalmentsRemaining: bnplPlans.instalmentsRemaining,
      nextPaymentDate: bnplPlans.nextPaymentDate,
      createdAt: bnplPlans.createdAt,
      provider: bnplAccounts.provider,
      spendingLimit: bnplAccounts.spendingLimit,
      availableLimit: bnplAccounts.availableLimit,
    })
    .from(bnplPlans)
    .innerJoin(bnplAccounts, eq(bnplPlans.bnplAccountId, bnplAccounts.id))
    .orderBy(bnplPlans.nextPaymentDate);

  // Auto-advance plans whose payment date has passed
  const today = new Date().toISOString().split("T")[0];

  for (const plan of plans) {
    let remaining = plan.instalmentsRemaining;
    let nextDate = plan.nextPaymentDate;
    let changed = false;

    while (nextDate <= today && remaining > 0) {
      remaining--;
      changed = true;
      if (remaining === 0) break;
      nextDate = advanceDate(nextDate, plan.instalmentFrequency);
    }

    if (changed) {
      if (remaining === 0) {
        // Fully paid off — remove the plan
        await db.delete(bnplPlans).where(eq(bnplPlans.id, plan.id));
      } else {
        // Update with new remaining count and next date
        await db
          .update(bnplPlans)
          .set({
            instalmentsRemaining: remaining,
            nextPaymentDate: nextDate,
          })
          .where(eq(bnplPlans.id, plan.id));
      }
      // Update in-memory for the response
      plan.instalmentsRemaining = remaining;
      plan.nextPaymentDate = nextDate;
    }
  }

  // Filter out completed plans from response
  const activePlans = plans.filter((p) => p.instalmentsRemaining > 0);

  return NextResponse.json(activePlans);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await db
    .insert(bnplPlans)
    .values({
      bnplAccountId: body.bnplAccountId,
      itemName: body.itemName,
      totalAmount: body.totalAmount,
      instalmentAmount: body.instalmentAmount,
      instalmentFrequency: body.instalmentFrequency,
      instalmentsTotal: body.instalmentsTotal,
      instalmentsRemaining: body.instalmentsRemaining,
      nextPaymentDate: body.nextPaymentDate,
    })
    .returning();
  return NextResponse.json(result[0], { status: 201 });
}
