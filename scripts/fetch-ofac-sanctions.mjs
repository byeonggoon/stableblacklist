#!/usr/bin/env node
/**
 * OFAC SDN 제재 암호화폐 주소를 수집해 sbl_sanctioned_addresses 에 적재.
 * 소스: 0xB10C/ofac-sanctioned-digital-currency-addresses (OFAC SDN 파생, 체인별 리스트).
 *
 * 실행: node --env-file=.env.local scripts/fetch-ofac-sanctions.mjs
 */
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket },
});

const BASE = 'https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists';
// 체인-네이티브 리스트만 사용 (토큰별 리스트는 동일 주소 중복이라 제외)
const SOURCES = [
  { file: 'sanctioned_addresses_ETH.json', chain: 'Ethereum' },
  { file: 'sanctioned_addresses_XBT.json', chain: 'Bitcoin' },
  { file: 'sanctioned_addresses_TRX.json', chain: 'Tron' },
];

let total = 0;
for (const { file, chain } of SOURCES) {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) { console.error(`${file}: HTTP ${res.status}`); continue; }
  const addrs = await res.json();
  // EVM 은 lowercase 로 정규화(노출 조회 일관성), Bitcoin/Tron 은 대소문자 보존
  const rows = addrs.map((a) => ({
    address: chain === 'Ethereum' ? String(a).toLowerCase() : String(a),
    chain,
    source: 'OFAC',
    updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('sbl_sanctioned_addresses').upsert(rows.slice(i, i + 500), { onConflict: 'address,chain' });
    if (error) console.error(`  upsert error (${chain}): ${error.message}`);
  }
  console.log(`${chain}: ${rows.length}개`);
  total += rows.length;
}
console.log(`\nDone. OFAC 제재 주소 ${total}개 적재.`);
