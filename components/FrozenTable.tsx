'use client';

import { useEffect, useState } from 'react';
import { fmtAmt, shortAddr, fmtDate } from '@/lib/format';

interface Row {
  address: string;
  token: string;
  chain: string;
  status: string;
  balance: number;
  frozen_at: string | null;
  destroyed_amount: number | null;
  destroyed_at: string | null;
}
interface ListResp { items: Row[]; total: number; page: number; totalPages: number; frozenSum: number }

const STATUSES = [
  { key: 'frozen', label: '동결 (frozen)', color: 'text-amber-300 border-amber-400/40 bg-amber-400/10' },
  { key: 'destroyed', label: '소각 (destroyed)', color: 'text-red-300 border-red-400/40 bg-red-400/10' },
  { key: 'unfrozen', label: '해제 (unfrozen)', color: 'text-neutral-300 border-neutral-500/40 bg-neutral-500/10' },
];

export default function FrozenTable() {
  const [status, setStatus] = useState('frozen');
  const [token, setToken] = useState('all');
  const [chain, setChain] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('balance_desc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(false);

  // 필터 변경 시 1페이지로 리셋 (effect 대신 핸들러에서 처리)
  const onFilter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      setLoading(true);
      const qs = new URLSearchParams({ status, token, chain, sort, page: String(page), limit: '25', search });
      try {
        const r = await fetch(`/api/frozen/list?${qs.toString()}`, { signal: ctrl.signal });
        const d: ListResp = await r.json();
        setData(d);
        setLoading(false);
      } catch {
        /* aborted */
      }
    };
    run();
    return () => ctrl.abort();
  }, [status, token, chain, search, sort, page]);

  const isDestroyed = status === 'destroyed';
  const amountLabel = isDestroyed ? '소각 금액' : '잔액';
  const dateLabel = isDestroyed ? '소각일' : '동결일';
  const badge = STATUSES.find((s) => s.key === status)?.color ?? '';

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02]">
      {/* status tabs + filters */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 p-3">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => onFilter(setStatus)(s.key)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              status === s.key ? s.color : 'border-white/10 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {s.label}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select value={token} onChange={(e) => onFilter(setToken)(e.target.value)}
            className="rounded-md border border-white/10 bg-transparent px-2 py-1.5 text-xs text-neutral-300">
            <option value="all">전체 토큰</option><option>USDT</option><option>USDC</option>
          </select>
          <select value={chain} onChange={(e) => onFilter(setChain)(e.target.value)}
            className="rounded-md border border-white/10 bg-transparent px-2 py-1.5 text-xs text-neutral-300">
            <option value="all">전체 체인</option><option>Ethereum</option><option>Tron</option>
          </select>
          <select value={sort} onChange={(e) => onFilter(setSort)(e.target.value)}
            className="rounded-md border border-white/10 bg-transparent px-2 py-1.5 text-xs text-neutral-300">
            <option value="balance_desc">금액 ↓</option><option value="balance_asc">금액 ↑</option>
            <option value="date_desc">날짜 ↓</option><option value="date_asc">날짜 ↑</option>
          </select>
          <input value={search} onChange={(e) => onFilter(setSearch)(e.target.value.trim())} placeholder="주소 검색 0x…"
            className="w-36 rounded-md border border-white/10 bg-transparent px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600" />
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-neutral-500">
            <tr className="border-b border-white/10">
              <th className="px-4 py-2.5 font-medium">주소</th>
              <th className="px-4 py-2.5 font-medium">토큰 / 체인</th>
              <th className="px-4 py-2.5 font-medium">상태</th>
              <th className="px-4 py-2.5 text-right font-medium">{amountLabel}</th>
              <th className="px-4 py-2.5 text-right font-medium">{dateLabel}</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[13px]">
            {(data?.items ?? []).map((r) => (
              <tr key={`${r.address}-${r.token}-${r.chain}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                <td className="px-4 py-2.5 text-neutral-300" title={r.address}>{shortAddr(r.address)}</td>
                <td className="px-4 py-2.5 text-neutral-400">{r.token} · {r.chain}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] ${badge}`}>{status}</span>
                </td>
                <td className="px-4 py-2.5 text-right text-neutral-100">
                  {fmtAmt(isDestroyed ? r.destroyed_amount : r.balance)}
                </td>
                <td className="px-4 py-2.5 text-right text-neutral-400">
                  {fmtDate(isDestroyed ? r.destroyed_at : r.frozen_at)}
                </td>
              </tr>
            ))}
            {!loading && (data?.items?.length ?? 0) === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-500">데이터 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* footer / pagination */}
      <div className="flex items-center justify-between gap-2 border-t border-white/10 p-3 text-xs text-neutral-500">
        <span>{loading ? '불러오는 중…' : `총 ${(data?.total ?? 0).toLocaleString()}건`}</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="rounded border border-white/10 px-2 py-1 disabled:opacity-30">이전</button>
          <span>{page} / {data?.totalPages ?? 1}</span>
          <button disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}
            className="rounded border border-white/10 px-2 py-1 disabled:opacity-30">다음</button>
        </div>
      </div>
    </section>
  );
}
