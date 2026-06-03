import { createBrowserClient } from "@supabase/ssr";

import { assertEnv } from "@/lib/env";

export function createClient() {
  assertEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"], "Supabase browser client");

  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
