'use client';

import { useEffect, useState } from 'react';
import FrozenTable from '@/components/FrozenTable';
import { fmtUsd0, fmtCount, fmtDateTime } from '@/lib/format';

interface Breakdown { token: string; chain: string; frozenCount: number; frozenSum: number }
interface Stats {
  frozen: number; destroyed: number; unfrozen: number;
  totalFrozenSum: number; breakdown: Breakdown[]; lastUpdated: string | null;
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

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/frozen/stats').then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0c10] text-neutral-200">
      <div className="mx-auto max-w-6xl px-5 py-10">
        {/* header */}
        <header className="mb-8">
          <div className="flex items-baseline gap-3">
            <h1 className="font-mono text-xl font-bold tracking-tight text-neutral-100">StableBlacklist</h1>
            <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300">
              freeze · destroy · sanctions tracker
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            스테이블코인 발행사 동결(Tether·Circle)과 소각을 온체인 이벤트로 추적합니다.
            balanceOf 로 추론하지 않고 <span className="text-neutral-300">DestroyedBlackFunds</span> 이벤트가
            실제 발생한 경우에만 소각으로 기록합니다.
          </p>
          {stats?.lastUpdated && (
            <p className="mt-1 text-xs text-neutral-600">마지막 갱신: {fmtDateTime(stats.lastUpdated)}</p>
          )}
        </header>

        {/* hero stats */}
        <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="현재 동결 잔액 합계" value={fmtUsd0(stats?.totalFrozenSum ?? 0)}
            sub="살아있는(미소각) 동결 자산" accent="text-amber-300" />
          <StatCard label="동결 주소" value={fmtCount(stats?.frozen ?? 0)} sub="status = frozen" />
          <StatCard label="소각 주소" value={fmtCount(stats?.destroyed ?? 0)} sub="DestroyedBlackFunds" accent="text-red-300" />
          <StatCard label="해제 주소" value={fmtCount(stats?.unfrozen ?? 0)} sub="status = unfrozen" />
        </section>

        {/* breakdown */}
        {stats?.breakdown && (
          <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.breakdown.map((b) => (
              <div key={`${b.token}-${b.chain}`} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <div className="font-mono text-sm text-neutral-300">{b.token} · {b.chain}</div>
                <div className="mt-1 font-mono text-lg text-neutral-100">{fmtUsd0(b.frozenSum)}</div>
                <div className="text-xs text-neutral-500">{fmtCount(b.frozenCount)} 개 주소 동결중</div>
              </div>
            ))}
          </section>
        )}

        {/* table */}
        <FrozenTable />

        <footer className="mt-8 text-center text-xs text-neutral-700">
          데이터 출처: Etherscan · Tron · 발행사 온체인 이벤트 — StableBlacklist
        </footer>
      </div>
    </main>
  );
}
