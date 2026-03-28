import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { toCamel } from "@/lib/db/camel";

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
    const supabase = await createClient();

    // Build query based on whether provider filter is provided
    if (provider) {
      if (!isValidProvider(provider)) {
        return NextResponse.json(
          { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('bnpl_agreements')
        .select('*')
        .eq('provider', provider)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(toCamel(data));
    }

    const { data, error } = await supabase
      .from('bnpl_agreements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(toCamel(data));
  } catch (error) {
    console.error("Error fetching BNPL agreements:", error);
    return NextResponse.json(
      { error: "Failed to fetch agreements" },
      { status: 500 }
    );
  }
}
