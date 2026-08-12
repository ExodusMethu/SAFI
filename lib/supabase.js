import { createClient } from '@supabase/supabase-js';

function getCleanUrl(rawUrl) {
  if (!rawUrl) return 'https://placeholder.supabase.co';
  return rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

const supabaseUrl = getCleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

