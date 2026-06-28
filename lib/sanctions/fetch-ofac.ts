import { getSupabase } from '@/lib/db/supabase';

const BASE = 'https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists';
// 체인-네이티브 리스트만 (토큰별 리스트는 동일 주소 중복)
const SOURCES = [
  { file: 'sanctioned_addresses_ETH.json', chain: 'Ethereum' },
  { file: 'sanctioned_addresses_XBT.json', chain: 'Bitcoin' },
  { file: 'sanctioned_addresses_TRX.json', chain: 'Tron' },
];

/** OFAC SDN 제재 암호화폐 주소를 수집해 sbl_sanctioned_addresses 에 upsert. */
export async function syncOfac(): Promise<{ chain: string; count: number }[]> {
  const sb = getSupabase();
  const results: { chain: string; count: number }[] = [];
  for (const { file, chain } of SOURCES) {
    const res = await fetch(`${BASE}/${file}`);
    if (!res.ok) { results.push({ chain, count: 0 }); continue; }
    const addrs = (await res.json()) as string[];
    const rows = addrs.map((a) => ({
      address: chain === 'Ethereum' ? String(a).toLowerCase() : String(a),
      chain,
      source: 'OFAC',
      updated_at: new Date().toISOString(),
    }));
    for (let i = 0; i < rows.length; i += 500) {
      await sb.from('sbl_sanctioned_addresses').upsert(rows.slice(i, i + 500), { onConflict: 'address,chain' });
    }
    results.push({ chain, count: rows.length });
  }
  return results;
}
