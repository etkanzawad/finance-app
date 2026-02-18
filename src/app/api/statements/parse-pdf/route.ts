import { NextRequest, NextResponse } from "next/server";
import { parsePdfStatement } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  try {
    const transactions = await parsePdfStatement(base64);

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions found in PDF" },
        { status: 422 }
      );
    }

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("PDF parsing error:", error);
    return NextResponse.json(
      { error: "Failed to parse PDF statement" },
      { status: 500 }
    );
  }
}
