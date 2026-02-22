import { NextRequest, NextResponse } from "next/server";
import { parseBnplScreenshot } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  try {
    const data = await parseBnplScreenshot(base64, file.type);
    return NextResponse.json(data);
  } catch (error) {
    console.error("BNPL screenshot parsing error:", error);
    return NextResponse.json(
      { error: "Failed to parse screenshot" },
      { status: 500 }
    );
  }
}
