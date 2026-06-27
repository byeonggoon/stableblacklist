import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** 서버 전용 Supabase 클라이언트 (service role). 브라우저 노출 방지 가드. */
export function getSupabase(): SupabaseClient {
  if (typeof window !== 'undefined') throw new Error('getSupabase is server-only');
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env not configured');
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
