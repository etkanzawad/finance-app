import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { toCamel } from "@/lib/db/camel";

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

    const supabase = await createClient();

    // Fetch the agreement to get the storage path
    const { data: agreement, error: fetchError } = await supabase
      .from('bnpl_agreements')
      .select('*')
      .eq('id', agreementId);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!agreement || agreement.length === 0) {
      return NextResponse.json(
        { error: "Agreement not found" },
        { status: 404 }
      );
    }

    const storagePath = agreement[0].storage_path;

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
    const { error: deleteError } = await supabase
      .from('bnpl_agreements')
      .delete()
      .eq('id', agreementId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

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

    const supabase = await createClient();

    const { data: agreement, error } = await supabase
      .from('bnpl_agreements')
      .select('*')
      .eq('id', agreementId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!agreement || agreement.length === 0) {
      return NextResponse.json(
        { error: "Agreement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(toCamel(agreement[0]));
  } catch (error) {
    console.error("Error fetching BNPL agreement:", error);
    return NextResponse.json(
      { error: "Failed to fetch agreement" },
      { status: 500 }
    );
  }
}
