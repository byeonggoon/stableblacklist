#!/usr/bin/env node
/**
 * [1회용 시드] chase-chain 이 이미 수집한 Tron USDT 동결 잔액을
 * StableBlacklist 의 sbl_frozen_wallets 로 복사한다 (같은 Supabase 프로젝트).
 *
 * 이유: 역사적 ~6,500개 Tron 주소 잔액을 TronGrid 로 새로 긁으면 수 분 + rate-limit 으로
 *      0 이 박힌다. 사용자가 이미 보유한 실데이터를 재사용해 즉시 채운다.
 *      이후 신규 동결은 tron-indexer(syncTron) 가 증분 처리한다.
 *
 * 실행: node --env-file=.env.local scripts/seed-tron-from-chasechain.mjs
 */
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws'; // Node 20 에는 global WebSocket 이 없어 supabase realtime 초기화가 실패 → 주입

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Supabase env 없음'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false }, realtime: { transport: WebSocket } });

const PAGE = 1000;
let from = 0;
let total = 0;

while (true) {
  const { data, error } = await sb
    .from('frozen_wallets') // chase-chain 원본 테이블
    .select('address, token, chain, balance, frozen_at')
    .eq('chain', 'Tron')
    .range(from, from + PAGE - 1);
  if (error) { console.error('read error:', error.message); process.exit(1); }
  if (!data.length) break;

  const rows = data.map((d) => ({
    address: d.address,
    token: d.token,
    chain: 'Tron',
    status: 'frozen',
    balance: d.balance ?? 0,
    frozen_at: d.frozen_at,
    destroyed_amount: null,
    destroyed_at: null,
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error: e2 } = await sb
      .from('sbl_frozen_wallets')
      .upsert(rows.slice(i, i + 500), { onConflict: 'address,token,chain' });
    if (e2) console.error('upsert error:', e2.message);
  }

  total += data.length;
  console.log(`seeded ${total}`);
  if (data.length < PAGE) break;
  from += PAGE;
}

// 인덱서가 이 시점 이후 신규 이벤트만 증분 처리하도록 커서를 now 로 설정
await sb.from('sbl_frozen_metadata').upsert({ key: 'lastTronTimestamp', value: String(Date.now()) }, { onConflict: 'key' });
console.log(`\nDone. Tron USDT seeded: ${total}. lastTronTimestamp cursor set to now.`);
