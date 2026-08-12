import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with service role key (bypasses RLS)
// Called fresh per-request in API routes
export function createServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder'
  );
}
