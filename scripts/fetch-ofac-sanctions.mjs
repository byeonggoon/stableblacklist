#!/usr/bin/env node
/**
 * OFAC 제재 암호화폐 주소 수집 → sbl_sanctioned_addresses.
 * 1) 0xB10C 체인별 리스트 = 주소 커버리지 (ETH/BTC/Tron)
 * 2) OFAC 공식 SDN.CSV = 엔티티명·프로그램 enrich
 *
 * 실행: node --env-file=.env.local scripts/fetch-ofac-sanctions.mjs
 */
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { parseOfacCsv } from '../lib/sanctions/parse-ofac-csv.mjs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket },
});

const LISTS = 'https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists';
const SRC = [
  { file: 'sanctioned_addresses_ETH.json', chain: 'Ethereum' },
  { file: 'sanctioned_addresses_XBT.json', chain: 'Bitcoin' },
  { file: 'sanctioned_addresses_TRX.json', chain: 'Tron' },
];
const CSV_URL = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV';

async function upsert(rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('sbl_sanctioned_addresses').upsert(rows.slice(i, i + 500), { onConflict: 'address,chain' });
    if (error) console.error('  upsert error:', error.message);
  }
}

// 1) 주소 커버리지
let coverage = 0;
for (const { file, chain } of SRC) {
  const res = await fetch(`${LISTS}/${file}`);
  if (!res.ok) { console.error(`${file}: HTTP ${res.status}`); continue; }
  const addrs = await res.json();
  const rows = addrs.map((a) => ({
    address: chain === 'Ethereum' ? String(a).toLowerCase() : String(a),
    chain, source: 'OFAC', updated_at: new Date().toISOString(),
  }));
  await upsert(rows);
  coverage += rows.length;
  console.log(`커버리지 ${chain}: ${rows.length}개`);
}

// 2) 엔티티/프로그램 enrich (SDN.CSV)
const csv = await (await fetch(CSV_URL)).text();
const enriched = parseOfacCsv(csv).map((r) => ({ ...r, updated_at: new Date().toISOString() }));
await upsert(enriched);
const byChain = {};
for (const r of enriched) byChain[r.chain] = (byChain[r.chain] || 0) + 1;
console.log('enrich(엔티티/프로그램):', JSON.stringify(byChain), 'total', enriched.length);
console.log(`\nDone. 커버리지 ${coverage}개 + enrich ${enriched.length}개`);
