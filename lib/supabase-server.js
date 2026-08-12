import { createClient } from '@supabase/supabase-js';

function getCleanUrl(rawUrl) {
  if (!rawUrl) return 'https://placeholder.supabase.co';
  return rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

// Server-side Supabase client with service role key (bypasses RLS)
// Called fresh per-request in API routes
export function createServerSupabase() {
  return createClient(
    getCleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder'
  );
}
