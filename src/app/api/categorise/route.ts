import { NextRequest, NextResponse } from "next/server";
import { categoriseTransactions } from "@/lib/gemini";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

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
  const body = await request.json();
  const { mappings } = body as {
    mappings: { rawPattern: string; cleanName: string; category: string }[];
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
    const existing = await db
      .select()
      .from(schema.merchantMappings)
      .where(eq(schema.merchantMappings.rawPattern, mapping.rawPattern));

    if (existing.length === 0) {
      const result = await db
        .insert(schema.merchantMappings)
        .values(mapping)
        .returning();
      saved.push(result[0]);
    }
  }

  return NextResponse.json({ saved: saved.length });
}
