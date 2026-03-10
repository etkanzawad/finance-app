// Purpose: idempotently create the "bnpl-agreements" Supabase Storage bucket
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing required environment variables:");
  if (!supabaseUrl) console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const BUCKET = "bnpl-agreements";

  // listBuckets to check existence
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error("Error listing buckets:", listErr);
    throw listErr;
  }

  const exists = buckets?.some((b) => b.name === BUCKET);

  if (exists) {
    console.log(`Bucket "${BUCKET}" already exists – skipping creation.`);
    return;
  }

  const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
    public: false,                   // private; signed URLs used for access
    fileSizeLimit: 10 * 1024 * 1024, // 10 MB max per file
    allowedMimeTypes: [
      "application/pdf",
      "text/markdown",
      "text/plain",
    ],
  });

  if (createErr) {
    console.error("Error creating bucket:", createErr);
    throw createErr;
  }
  console.log(`Bucket "${BUCKET}" created successfully.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
