import { createClient as createSupabaseClient } from "@/lib/supabase/server";

export async function getDb() {
  return createSupabaseClient();
}
