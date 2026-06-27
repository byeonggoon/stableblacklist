import { getSupabase } from './supabase';
import type { FrozenRow } from '@/lib/indexer/state-machine';

// 옵션 A: 기존 Supabase 재사용 → sbl_ 접두사로 격리
const TABLE = 'sbl_frozen_wallets';
const META = 'sbl_frozen_metadata';

export interface DbFrozenRow {
  address: string; token: string; chain: string; status: string;
  balance: string; frozen_at: string | null;
  destroyed_amount: string | null; destroyed_at: string | null; updated_at: string;
}

/** 순수: 도메인 Row → DB row (bigint→string, ts→ISO). */
export function rowToDb(r: FrozenRow): DbFrozenRow {
  return {
    address: r.address, token: r.token, chain: r.chain, status: r.status,
    balance: r.balance.toString(),
    frozen_at: r.frozen_at != null ? new Date(r.frozen_at * 1000).toISOString() : null,
    destroyed_amount: r.destroyed_amount != null ? r.destroyed_amount.toString() : null,
    destroyed_at: r.destroyed_at != null ? new Date(r.destroyed_at * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
}

/** 주소 집합의 현재 행을 Map 으로 로드 (token/chain 스코프). */
export async function loadRows(addresses: string[], token: string, chain: string): Promise<Map<string, FrozenRow>> {
  const sb = getSupabase();
  const map = new Map<string, FrozenRow>();
  for (let i = 0; i < addresses.length; i += 500) {
    const batch = addresses.slice(i, i + 500);
    const { data } = await sb.from(TABLE).select('*')
      .eq('token', token).eq('chain', chain).in('address', batch);
    for (const d of data ?? []) {
      map.set(d.address, {
        address: d.address, token: d.token, chain: d.chain, status: d.status,
        balance: Number(d.balance ?? 0),
        frozen_at: d.frozen_at ? Math.floor(new Date(d.frozen_at).getTime() / 1000) : null,
        destroyed_amount: d.destroyed_amount != null ? Number(d.destroyed_amount) : undefined,
        destroyed_at: d.destroyed_at ? Math.floor(new Date(d.destroyed_at).getTime() / 1000) : undefined,
      });
    }
  }
  return map;
}

/** 행들을 upsert (복합 PK). */
export async function upsertRows(rows: FrozenRow[]): Promise<void> {
  if (rows.length === 0) return;
  const sb = getSupabase();
  const dbRows = rows.map(rowToDb);
  for (let i = 0; i < dbRows.length; i += 500) {
    const { error } = await sb.from(TABLE)
      .upsert(dbRows.slice(i, i + 500), { onConflict: 'address,token,chain' });
    if (error) throw new Error(`upsert failed: ${error.message}`);
  }
}

export async function getCursor(key: string): Promise<string | null> {
  const sb = getSupabase();
  const { data } = await sb.from(META).select('value').eq('key', key).single();
  return data?.value ?? null;
}

export async function setCursor(key: string, value: string): Promise<void> {
  const sb = getSupabase();
  await sb.from(META).upsert({ key, value }, { onConflict: 'key' });
}
