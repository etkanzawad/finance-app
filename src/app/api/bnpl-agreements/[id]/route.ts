import { db } from "@/lib/db";
import { bnplAgreements } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agreementId = Number(id);

    if (isNaN(agreementId)) {
      return NextResponse.json(
        { error: "Invalid agreement ID" },
        { status: 400 }
      );
    }

    // Fetch the agreement to get the storage path
    const agreement = await db
      .select()
      .from(bnplAgreements)
      .where(eq(bnplAgreements.id, agreementId));

    if (agreement.length === 0) {
      return NextResponse.json(
        { error: "Agreement not found" },
        { status: 404 }
      );
    }

    const storagePath = agreement[0].storagePath;

    // Initialize Supabase client
    const supabase = await createClient();

    // Delete file from Supabase Storage
    const { error: storageError } = await supabase
      .storage
      .from("bnpl-agreements")
      .remove([storagePath]);

    if (storageError) {
      console.error("Supabase storage delete error:", storageError);
      // Continue to delete DB record even if storage deletion fails
      // The file might have already been deleted or never existed
    }

    // Delete record from database
    await db.delete(bnplAgreements).where(eq(bnplAgreements.id, agreementId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting BNPL agreement:", error);
    return NextResponse.json(
      { error: "Failed to delete agreement" },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agreementId = Number(id);

    if (isNaN(agreementId)) {
      return NextResponse.json(
        { error: "Invalid agreement ID" },
        { status: 400 }
      );
    }

    const agreement = await db
      .select()
      .from(bnplAgreements)
      .where(eq(bnplAgreements.id, agreementId));

    if (agreement.length === 0) {
      return NextResponse.json(
        { error: "Agreement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(agreement[0]);
  } catch (error) {
    console.error("Error fetching BNPL agreement:", error);
    return NextResponse.json(
      { error: "Failed to fetch agreement" },
      { status: 500 }
    );
  }
}
