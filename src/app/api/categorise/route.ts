import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { categoriseTransactions } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { descriptions } = body as { descriptions: string[] };

  if (!descriptions || !Array.isArray(descriptions) || descriptions.length === 0) {
    return NextResponse.json(
      { error: "descriptions array required" },
      { status: 400 }
    );
  }

  if (descriptions.length > 50) {
    return NextResponse.json(
      { error: "Maximum 50 descriptions per request" },
      { status: 400 }
    );
  }

  try {
    const results = await categoriseTransactions(descriptions);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: "Categorisation failed" },
      { status: 500 }
    );
  }
}

// Save reviewed mappings
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { mappings } = body as {
    mappings: { raw_pattern: string; clean_name: string; category: string }[];
  };

  if (!mappings || !Array.isArray(mappings)) {
    return NextResponse.json(
      { error: "mappings array required" },
      { status: 400 }
    );
  }

  const saved = [];
  for (const mapping of mappings) {
    // Check if pattern already exists
    const { data: existing, error: fetchError } = await supabase
      .from('merchant_mappings')
      .select('*')
      .eq('raw_pattern', mapping.raw_pattern);
    if (fetchError) throw fetchError;

    if (existing.length === 0) {
      const { data: result, error: insertError } = await supabase
        .from('merchant_mappings')
        .insert(mapping)
        .select();
      if (insertError) throw insertError;
      saved.push(result[0]);
    }
  }

  return NextResponse.json({ saved: saved.length });
}
