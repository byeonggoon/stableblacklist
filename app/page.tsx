'use client';

import { useEffect, useState } from 'react';
import FrozenTable from '@/components/FrozenTable';
import SanctionsTable from '@/components/SanctionsTable';
import { fmtUsd0, fmtCount, fmtDateTime } from '@/lib/format';
import { useT, type Lang } from '@/lib/i18n';

interface Breakdown { token: string; chain: string; frozenCount: number; frozenSum: number }
interface Stats {
  frozen: number; destroyed: number; unfrozen: number;
  totalFrozenSum: number; breakdown: Breakdown[];
  sanctioned: number; lastUpdated: string | null;
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${accent ?? 'text-neutral-100'}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

function LangToggle() {
  const { lang, setLang } = useT();
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-white/10 p-0.5">
      {(['ko', 'en'] as Lang[]).map((l) => (
        <button key={l} onClick={() => setLang(l)}
          className={`rounded px-2 py-1 text-xs font-medium transition ${
            lang === l ? 'bg-white/10 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
          }`}>
          {l === 'ko' ? 'KR' : 'EN'}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const { t, lang } = useT();
  const [stats, setStats] = useState<Stats | null>(null);
  const [view, setView] = useState<'frozen' | 'sanctions'>('frozen');

  useEffect(() => {
    fetch('/api/frozen/stats').then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0c10] text-neutral-200">
      <div className="mx-auto max-w-6xl px-5 py-10">
        {/* header */}
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <h1 className="font-mono text-xl font-bold tracking-tight text-neutral-100">StableBlacklist</h1>
              <span className="hidden rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300 sm:inline">
                {t('tagline')}
              </span>
            </div>
            <LangToggle />
          </div>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">{t('desc')}</p>
          {stats?.lastUpdated && (
            <p className="mt-1 text-xs text-neutral-600">{t('lastUpdated')}: {fmtDateTime(stats.lastUpdated)}</p>
          )}
        </header>

        {/* hero stats */}
        <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label={t('statTotalLabel')} value={fmtUsd0(stats?.totalFrozenSum ?? 0)}
            sub={t('statTotalSub')} accent="text-amber-300" />
          <StatCard label={t('statFrozen')} value={fmtCount(stats?.frozen ?? 0)} sub="status = frozen" />
          <StatCard label={t('statDestroyed')} value={fmtCount(stats?.destroyed ?? 0)} sub="DestroyedBlackFunds" accent="text-red-300" />
          <StatCard label={t('statUnfrozen')} value={fmtCount(stats?.unfrozen ?? 0)} sub="status = unfrozen" />
          <StatCard label={t('statSanctioned')} value={fmtCount(stats?.sanctioned ?? 0)} sub="OFAC SDN" accent="text-red-300" />
        </section>

        {/* breakdown */}
        {stats?.breakdown && (
          <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.breakdown.map((b) => (
              <div key={`${b.token}-${b.chain}`} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <div className="font-mono text-sm text-neutral-300">{b.token} · {b.chain}</div>
                <div className="mt-1 font-mono text-lg text-neutral-100">{fmtUsd0(b.frozenSum)}</div>
                <div className="text-xs text-neutral-500">
                  {lang === 'ko'
                    ? `${fmtCount(b.frozenCount)}${t('addressesFrozen')}`
                    : `${fmtCount(b.frozenCount)} ${t('addressesFrozen')}`}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* view toggle: 발행사 동결 / OFAC 제재 */}
        <div className="mb-3 flex gap-2">
          {([['frozen', t('viewFrozen')], ['sanctions', t('viewSanctions')]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                view === v ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' : 'border-white/10 text-neutral-400 hover:text-neutral-200'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* table */}
        {view === 'frozen' ? <FrozenTable /> : <SanctionsTable />}

        <footer className="mt-8 text-center text-xs text-neutral-700">{t('footer')}</footer>
      </div>
    </main>
  );
}
