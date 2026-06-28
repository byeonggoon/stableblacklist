import { getSupabase } from '@/lib/db/supabase';
import { parseOfacCsv } from './parse-ofac-csv.mjs';

const LISTS = 'https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists';
const SRC = [
  { file: 'sanctioned_addresses_ETH.json', chain: 'Ethereum' },
  { file: 'sanctioned_addresses_XBT.json', chain: 'Bitcoin' },
  { file: 'sanctioned_addresses_TRX.json', chain: 'Tron' },
];
const CSV_URL = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV';

interface OfacRow { address: string; chain: string; source: string; entity?: string; programs?: string; updated_at: string }

/**
 * OFAC 제재 주소 수집:
 * 1) 0xB10C 체인별 리스트 = 주소 커버리지
 * 2) SDN.CSV = 엔티티명·프로그램 enrich (실패해도 커버리지는 유지)
 */
export async function syncOfac(): Promise<{ chain: string; count: number }[]> {
  const sb = getSupabase();

  const upsert = async (rows: OfacRow[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      await sb.from('sbl_sanctioned_addresses').upsert(rows.slice(i, i + 500), { onConflict: 'address,chain' });
    }
  };

  const results: { chain: string; count: number }[] = [];
  for (const { file, chain } of SRC) {
    const res = await fetch(`${LISTS}/${file}`);
    if (!res.ok) { results.push({ chain, count: 0 }); continue; }
    const addrs = (await res.json()) as string[];
    const rows: OfacRow[] = addrs.map((a) => ({
      address: chain === 'Ethereum' ? String(a).toLowerCase() : String(a),
      chain, source: 'OFAC', updated_at: new Date().toISOString(),
    }));
    await upsert(rows);
    results.push({ chain, count: rows.length });
  }

  try {
    const csv = await (await fetch(CSV_URL)).text();
    const enriched = parseOfacCsv(csv).map((r: Omit<OfacRow, 'updated_at'>) => ({ ...r, updated_at: new Date().toISOString() }));
    await upsert(enriched);
  } catch { /* enrich 실패해도 커버리지는 유지 */ }

  return results;
}
