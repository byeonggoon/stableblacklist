#!/usr/bin/env node
/**
 * sbl_frozen_wallets 의 balance=0 Tron frozen 행을 TronGrid 로 재조회해 실제 잔액으로 보정.
 * 시드 데이터의 rate-limit 0 artifact 수정. 진짜 0은 그대로 둠.
 *
 * rate-limit 안전 모드: 동시성 2, null(조회실패)은 0으로 덮지 않고 다음 패스로 미룸.
 * (배치를 빨리 때리면 TronGrid 가 429 → null → 실제 잔액을 0으로 오인하므로 보수적으로)
 *
 * 실행: node --env-file=.env.local scripts/refetch-zero-balances.mjs
 */
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { fetchTronBalance, sleep } from '../lib/indexer/_balances.mjs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket },
});

// 1) balance=0 Tron frozen 주소 전부 수집
const addrs = [];
let from = 0;
while (true) {
  const { data, error } = await sb.from('sbl_frozen_wallets').select('address')
    .eq('status', 'frozen').eq('chain', 'Tron').eq('balance', 0).range(from, from + 999);
  if (error) { console.error('read error:', error.message); process.exit(1); }
  if (!data.length) break;
  addrs.push(...data.map((d) => d.address));
  if (data.length < 1000) break;
  from += 1000;
}
console.log(`balance=0 Tron 주소 ${addrs.length}개 — rate-limit 안전 모드(동시2, null 재시도)로 재조회`);

// null-aware: 조회 실패(null)면 backoff 재시도, 끝내 실패면 null 반환(0으로 덮지 않음)
async function balOf(addr) {
  for (let i = 0; i < 4; i++) {
    const b = await fetchTronBalance(addr);
    if (b !== null) return b;
    await sleep(800 * (i + 1));
  }
  return null;
}

const CONC = 2;
let checked = 0, updated = 0, failed = 0, recovered = 0;
for (let i = 0; i < addrs.length; i += CONC) {
  const batch = addrs.slice(i, i + CONC);
  const bals = await Promise.all(batch.map(balOf));
  for (let j = 0; j < batch.length; j++) {
    checked++;
    const b = bals[j];
    if (b === null) { failed++; continue; } // 검증 실패 → 다음 패스 대상 (0 그대로 둠)
    if (b > 0) {
      const { error } = await sb.from('sbl_frozen_wallets')
        .update({ balance: b, updated_at: new Date().toISOString() })
        .eq('address', batch[j]).eq('token', 'USDT').eq('chain', 'Tron');
      if (!error) { updated++; recovered += b; }
    }
  }
  if (checked % 200 < CONC) console.log(`  ${checked}/${addrs.length} | 보정 ${updated} | 검증실패 ${failed}`);
  await sleep(400);
}
console.log(`\n완료. ${checked} 확인 / ${updated} 보정 / ${failed} 검증실패(다음 패스 대상). 복구 합계: ${Math.round(recovered).toLocaleString()} USDT`);
