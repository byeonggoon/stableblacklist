// OFAC SDN.CSV 파서 (스크립트·cron 공용, 순수 함수).
// 각 행: ent_num,"SDN_Name","Type","[PROG] [PROG]",...,"Remarks(Digital Currency Address 포함)"
// → 암호화폐 주소(Ethereum/Bitcoin/Tron만) + 엔티티명 + 프로그램 추출.

const ADDR_RE = /Digital Currency Address - (\w+)\s+([^;,\s]+)/g;

/** 따옴표·콤마 포함 CSV 한 줄을 필드 배열로. */
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

/** 주소 형식으로 체인 판별 (Ethereum/Bitcoin/Tron 외엔 null → 제외). */
function chainOf(currency, addr) {
  if (currency === 'XBT') return 'Bitcoin';
  if (currency === 'ETH') return 'Ethereum';
  if (currency === 'TRX') return 'Tron';
  // USDT/USDC 등 토큰은 주소 형식으로
  if (/^0x[0-9a-fA-F]{40}$/.test(addr)) return 'Ethereum';
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) return 'Tron';
  if (/^(bc1|[13])[0-9a-zA-HJ-NP-Z]{20,}$/.test(addr)) return 'Bitcoin';
  return null; // 기타 체인(XMR/XRP/ETC/BSC/LTC 등) 제외
}

/** 프로그램 필드 정리: 대괄호 제거 후 토큰화 ("IRAN] [SDGT] [IRGC" → "IRAN, SDGT, IRGC") */
function cleanPrograms(field) {
  return field
    .replace(/[[\]]/g, ' ')
    .split(/\s+/)
    .map((p) => p.trim())
    .filter((p) => p && p !== '-' && p !== '-0-')
    .join(', ');
}

/** CSV 전체 텍스트 → [{ address, chain, entity, programs }] (체인별 dedup). */
export function parseOfacCsv(csvText) {
  const seen = new Set();
  const rows = [];
  for (const line of csvText.split(/\r?\n/)) {
    if (!line.includes('Digital Currency Address')) continue;
    const f = splitCsvLine(line);
    const entity = f[1] || '';
    const programs = cleanPrograms(f[3] || '');
    const remarks = f.find((x) => x.includes('Digital Currency Address')) || '';
    for (const m of remarks.matchAll(ADDR_RE)) {
      const currency = m[1];
      let addr = m[2];
      const chain = chainOf(currency, addr);
      if (!chain) continue;
      if (chain === 'Ethereum') addr = addr.toLowerCase();
      const key = `${addr}|${chain}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ address: addr, chain, source: 'OFAC', entity, programs });
    }
  }
  return rows;
}
