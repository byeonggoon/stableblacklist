'use client';

import { useEffect, useState } from 'react';
import { shortAddr, explorerUrl } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { programDesc } from '@/lib/sanctions/programs';
import { CopyButton, PillGroup } from './table-ui';

interface SanctionRow {
  address: string;
  chain: string;
  source: string;
  entity?: string | null;
  programs?: string | null;
}
interface ListResp { items: SanctionRow[]; total: number; page: number; totalPages: number }

export default function SanctionsTable() {
  const { t, lang } = useT();
  const [chain, setChain] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const onChain = (v: string) => { setChain(v); setPage(1); };

  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(false);
      const qs = new URLSearchParams({ chain, page: String(page), limit: '25', search });
      try {
        const r = await fetch(`/api/sanctions/list?${qs.toString()}`, { signal: ctrl.signal });
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
  }, [chain, search, page]);

  const items = data?.items ?? [];
  const totalText = lang === 'ko'
    ? `총 ${(data?.total ?? 0).toLocaleString()}건`
    : `${(data?.total ?? 0).toLocaleString()} total`;

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
        <span className="rounded border border-red-400/40 bg-red-400/10 px-2 py-1 text-xs text-red-300">OFAC SDN</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PillGroup value={chain} onChange={onChain}
            options={[{ value: 'all', label: t('all') }, { value: 'Ethereum', label: 'ETH' }, { value: 'Bitcoin', label: 'BTC' }, { value: 'Tron', label: 'Tron' }]} />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={t('searchPlaceholder')}
            className="w-32 rounded-md border border-white/10 bg-transparent px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 sm:w-36" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-neutral-500">
            <tr className="border-b border-white/10">
              <th className="px-4 py-2.5 font-medium">{t('colAddress')}</th>
              <th className="px-4 py-2.5 font-medium">{t('colChain')}</th>
              <th className="px-4 py-2.5 font-medium">{t('colEntity')}</th>
              <th className="px-4 py-2.5 font-medium">{t('colSource')}</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[13px]">
            {error ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center font-sans text-sm text-red-400">{t('error')}</td></tr>
            ) : loading && !data ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-3 animate-pulse rounded bg-white/10" /></td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center font-sans text-sm text-neutral-500">{t('empty')}</td></tr>
            ) : (
              items.map((r) => (
                <tr key={`${r.address}-${r.chain}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <a href={explorerUrl(r.chain, r.address)} target="_blank" rel="noopener noreferrer" title={r.address}
                        className="text-neutral-300 transition hover:text-amber-300 hover:underline">{shortAddr(r.address)}</a>
                      <CopyButton address={r.address} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-neutral-400">{r.chain}</td>
                  <td className="px-4 py-2.5">
                    {r.entity ? (
                      <div className="max-w-[340px]">
                        <div className="truncate font-sans text-neutral-300" title={r.entity}>{r.entity}</div>
                        {r.programs && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {r.programs.split(',').map((c) => c.trim()).filter(Boolean).map((code) => (
                              <span key={code} title={programDesc(code, lang)}
                                className="cursor-help rounded bg-red-400/10 px-1 text-[10px] text-red-300/90 underline decoration-dotted decoration-red-300/40 underline-offset-2">
                                {code}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded border border-red-400/40 bg-red-400/10 px-1.5 py-0.5 text-[10px] text-red-300">{r.source}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
