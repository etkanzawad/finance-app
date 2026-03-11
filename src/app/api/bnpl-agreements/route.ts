import { db } from "@/lib/db";
import { bnplAgreements } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Valid BNPL providers — reject anything else
const VALID_PROVIDERS = ["afterpay", "zip_pay", "zip_money", "paypal_pay4"] as const;
type BnplProvider = typeof VALID_PROVIDERS[number];

function isValidProvider(value: string): value is BnplProvider {
  return (VALID_PROVIDERS as readonly string[]).includes(value);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    // Build query based on whether provider filter is provided
    if (provider) {
      if (!isValidProvider(provider)) {
        return NextResponse.json(
          { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
          { status: 400 }
        );
      }
      const rows = await db
        .select()
        .from(bnplAgreements)
        .where(eq(bnplAgreements.provider, provider))
        .orderBy(desc(bnplAgreements.createdAt));
      return NextResponse.json(rows);
    }

    const rows = await db
      .select()
      .from(bnplAgreements)
      .orderBy(desc(bnplAgreements.createdAt));
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching BNPL agreements:", error);
    return NextResponse.json(
      { error: "Failed to fetch agreements" },
      { status: 500 }
    );
  }
}
