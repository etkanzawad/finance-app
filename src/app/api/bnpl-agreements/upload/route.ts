import { db } from "@/lib/db";
import { bnplAgreements } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Valid BNPL providers
const VALID_PROVIDERS = ["afterpay", "zip_pay", "zip_money", "paypal_pay4"] as const;
type BnplProvider = typeof VALID_PROVIDERS[number];

function isValidProvider(provider: string): provider is BnplProvider {
  return VALID_PROVIDERS.includes(provider as BnplProvider);
}

// PDF magic bytes: %PDF
function isPdfByMagicBytes(buffer: Buffer): boolean {
  return buffer.length >= 4 && 
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46;   // F
}

export async function POST(req: NextRequest) {
  let storagePath: string | null = null;
  
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const provider = formData.get("provider") as string | null;
    const notes = formData.get("notes") as string | null;

    // Validation
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
        { status: 400 }
      );
    }

    // Read file buffer for validation and upload
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Validate file size (max 10MB) - check actual buffer size
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileBuffer.length > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Validate file type by extension and magic bytes
    const ext = file.name.toLowerCase().split('.').pop();
    const isPdfExt = ext === 'pdf';
    const isMdExt = ext === 'md';
    const isTxtExt = ext === 'txt';
    
    if (!isPdfExt && !isMdExt && !isTxtExt) {
      return NextResponse.json(
        { error: "Only PDF and Markdown (.md, .txt) files are allowed" },
        { status: 400 }
      );
    }

    // For PDFs, validate magic bytes to prevent spoofing
    if (isPdfExt && !isPdfByMagicBytes(fileBuffer)) {
      return NextResponse.json(
        { error: "Invalid PDF file - file signature does not match PDF format" },
        { status: 400 }
      );
    }

    // For text files, validate they are actually text (no null bytes in first 1KB)
    if (isMdExt || isTxtExt) {
      const sampleSize = Math.min(fileBuffer.length, 1024);
      for (let i = 0; i < sampleSize; i++) {
        if (fileBuffer[i] === 0x00) {
          return NextResponse.json(
            { error: "Invalid text file - contains binary data" },
            { status: 400 }
          );
        }
      }
    }

    // Initialize Supabase client
    const supabase = await createClient();

    // Generate unique filename
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    storagePath = `${provider}/${timestamp}-${safeFileName}`;

    // Upload file to Supabase Storage
    const contentType = isPdfExt 
      ? "application/pdf" 
      : isMdExt 
        ? "text/markdown" 
        : "text/plain";
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from("bnpl-agreements")
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    // Extract text from file (best-effort)
    let extractedText: string | null = null;
    try {
      if (isMdExt || isTxtExt) {
        extractedText = fileBuffer.toString('utf-8');
      }
      // PDF text extraction skipped - requires pdf-parse package
      // TODO: Add pdf-parse dependency if PDF text search is needed
    } catch (extractError) {
      console.error("Error extracting text:", extractError);
      // Upload still succeeds — text extraction is best-effort
      extractedText = null;
    }

    // Save metadata to database
    const result = await db
      .insert(bnplAgreements)
      .values({
        provider,
        fileName: file.name,
        fileSize: fileBuffer.length,
        storagePath,
        publicUrl: storagePath, // Store path only - generate signed URLs on demand
        extractedText,
        notes: notes ?? null,
      })
      .returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error("Error uploading BNPL agreement:", error);
    
    // Clean up orphaned storage file if DB insert failed
    if (storagePath) {
      try {
        const supabase = await createClient();
        await supabase.storage.from("bnpl-agreements").remove([storagePath]);
      } catch (cleanupError) {
        console.error("Failed to clean up orphaned storage file:", cleanupError);
      }
    }
    
    return NextResponse.json(
      { error: "Failed to upload agreement" },
      { status: 500 }
    );
  }
}
