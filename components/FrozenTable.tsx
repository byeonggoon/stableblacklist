'use client';

import { useEffect, useState } from 'react';
import { fmtAmt, shortAddr, fmtDate, explorerUrl } from '@/lib/format';
import { useT, type TKey } from '@/lib/i18n';
import { CopyButton, PillGroup } from './table-ui';

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

const STATUSES: { key: string; tKey: TKey; color: string }[] = [
  { key: 'frozen', tKey: 'tabFrozen', color: 'text-amber-300 border-amber-400/40 bg-amber-400/10' },
  { key: 'destroyed', tKey: 'tabDestroyed', color: 'text-red-300 border-red-400/40 bg-red-400/10' },
  { key: 'unfrozen', tKey: 'tabUnfrozen', color: 'text-neutral-300 border-neutral-500/40 bg-neutral-500/10' },
];

export default function FrozenTable() {
  const { t, lang } = useT();
  const [status, setStatus] = useState('frozen');
  const [token, setToken] = useState('all');
  const [chain, setChain] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState(''); // 디바운스 전 원본 입력
  const [sort, setSort] = useState('balance_desc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const onFilter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  // 정렬 헤더 클릭: 같은 필드면 방향 토글, 다른 필드면 내림차순부터
  const handleSort = (field: 'balance' | 'date') => {
    setSort((cur) => (cur === `${field}_desc` ? `${field}_asc` : `${field}_desc`));
    setPage(1);
  };

  // 검색 디바운스: 타이핑 멈춘 뒤 350ms 후에만 검색어 반영 (매 키 입력마다 fetch 방지)
  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(false);
      const qs = new URLSearchParams({ status, token, chain, sort, page: String(page), limit: '25', search });
      try {
        const r = await fetch(`/api/frozen/list?${qs.toString()}`, { signal: ctrl.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setData(await r.json());
        setLoading(false);
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
        setError(true);
        setLoading(false);
      }
    };
    run();
    return () => ctrl.abort();
  }, [status, token, chain, search, sort, page]);

  const isDestroyed = status === 'destroyed';
  const amountLabel = isDestroyed ? t('colBurned') : t('colBalance');
  const dateLabel = isDestroyed ? t('colBurnedAt') : t('colFrozenAt');
  const badge = STATUSES.find((s) => s.key === status)?.color ?? '';
  const items = data?.items ?? [];
  const totalText = lang === 'ko'
    ? `총 ${(data?.total ?? 0).toLocaleString()}건`
    : `${(data?.total ?? 0).toLocaleString()} total`;

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02]">
      {/* status tabs + filters */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 p-3">
        {STATUSES.map((s) => (
          <button key={s.key} onClick={() => onFilter(setStatus)(s.key)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              status === s.key ? s.color : 'border-white/10 text-neutral-400 hover:text-neutral-200'
            }`}>
            {t(s.tKey)}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PillGroup value={token} onChange={onFilter(setToken)}
            options={[{ value: 'all', label: t('all') }, { value: 'USDT', label: 'USDT' }, { value: 'USDC', label: 'USDC' }]} />
          <PillGroup value={chain} onChange={onFilter(setChain)}
            options={[{ value: 'all', label: t('all') }, { value: 'Ethereum', label: 'ETH' }, { value: 'Tron', label: 'Tron' }]} />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={t('searchPlaceholder')}
            className="w-32 rounded-md border border-white/10 bg-transparent px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 sm:w-36" />
        </div>
      </div>

      {/* table (모바일: 가로 스크롤) */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-neutral-500">
            <tr className="border-b border-white/10">
              <th className="px-4 py-2.5 font-medium">{t('colAddress')}</th>
              <th className="px-4 py-2.5 font-medium">{t('colTokenChain')}</th>
              <th className="px-4 py-2.5 font-medium">{t('colStatus')}</th>
              <th className="px-4 py-2.5 text-right font-medium">
                <button onClick={() => handleSort('balance')}
                  className={`inline-flex items-center gap-1 rounded transition hover:text-neutral-200 ${sort.startsWith('balance') ? 'text-amber-300' : ''}`}>
                  {amountLabel}
                  <span className="text-[9px] leading-none">{sort.startsWith('balance') ? (sort.endsWith('asc') ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
              <th className="px-4 py-2.5 text-right font-medium">
                <button onClick={() => handleSort('date')}
                  className={`inline-flex items-center gap-1 rounded transition hover:text-neutral-200 ${sort.startsWith('date') ? 'text-amber-300' : ''}`}>
                  {dateLabel}
                  <span className="text-[9px] leading-none">{sort.startsWith('date') ? (sort.endsWith('asc') ? '▲' : '▼') : '↕'}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="font-mono text-[13px]">
            {error ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center font-sans text-sm text-red-400">{t('error')}</td></tr>
            ) : loading && !data ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-3 animate-pulse rounded bg-white/10" /></td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center font-sans text-sm text-neutral-500">{t('empty')}</td></tr>
            ) : (
              items.map((r) => (
                <tr key={`${r.address}-${r.token}-${r.chain}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <a href={explorerUrl(r.chain, r.address)} target="_blank" rel="noopener noreferrer" title={r.address}
                        className="text-neutral-300 transition hover:text-amber-300 hover:underline">{shortAddr(r.address)}</a>
                      <CopyButton address={r.address} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-neutral-400">{r.token} · {r.chain}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] ${badge}`}>{status}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-neutral-100">
                    {fmtAmt(isDestroyed ? r.destroyed_amount : r.balance)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-neutral-400">
                    {fmtDate(isDestroyed ? r.destroyed_at : r.frozen_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* footer / pagination */}
      <div className="flex items-center justify-between gap-2 border-t border-white/10 p-3 text-xs text-neutral-500">
        <span>{loading ? t('loading') : totalText}</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="rounded border border-white/10 px-2 py-1 disabled:opacity-30">{t('prev')}</button>
          <span>{page} / {data?.totalPages ?? 1}</span>
          <button disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}
            className="rounded border border-white/10 px-2 py-1 disabled:opacity-30">{t('next')}</button>
        </div>
      </div>
    </section>
  );
}
