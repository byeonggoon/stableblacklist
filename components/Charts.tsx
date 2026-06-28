'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';

interface MonthRow { month: string; frozen: number; destroyed: number }

function MonthlyChart({ data }: { data: MonthRow[] }) {
  const W = 880, H = 170, padL = 28, padR = 6, padT = 12, padB = 22;
  const max = Math.max(1, ...data.map((d) => Math.max(Number(d.frozen), Number(d.destroyed))));
  const n = data.length || 1;
  const groupW = (W - padL - padR) / n;
  const barW = Math.max(1.5, Math.min(10, groupW / 2 - 1));
  const labelStep = Math.max(1, Math.ceil(n / 14));
  const plotH = H - padT - padB;
  const yOf = (v: number) => padT + plotH * (1 - v / max);
  const hOf = (v: number) => plotH * (v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="monthly activity">
      <text x={2} y={padT + 7} className="fill-neutral-600 text-[9px]">{max}</text>
      <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} className="stroke-white/10" strokeWidth={1} />
      {data.map((d, i) => {
        const x = padL + i * groupW;
        const f = Number(d.frozen), de = Number(d.destroyed);
        return (
          <g key={d.month}>
            <rect x={x} y={yOf(f)} width={barW} height={hOf(f)} className="fill-amber-400/70" rx={1}>
              <title>{d.month} · frozen {f}</title>
            </rect>
            <rect x={x + barW + 1} y={yOf(de)} width={barW} height={hOf(de)} className="fill-red-400/70" rx={1}>
              <title>{d.month} · destroyed {de}</title>
            </rect>
            {i % labelStep === 0 && <text x={x} y={H - 7} className="fill-neutral-600 text-[8px]">{d.month.slice(2)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export default function Charts() {
  const { t } = useT();
  const [data, setData] = useState<MonthRow[] | null>(null);

  useEffect(() => {
    fetch('/api/frozen/timeline').then((r) => r.json()).then((d) => setData(d.monthly ?? [])).catch(() => {});
  }, []);

  return (
    <section className="mb-8 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-neutral-500">{t('chartMonthly')}</div>
      {data ? <MonthlyChart data={data} /> : <div className="h-[170px] animate-pulse rounded bg-white/5" />}
      <div className="mt-2 flex gap-4 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-amber-400/70" />{t('legendFrozen')}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-red-400/70" />{t('legendDestroyed')}</span>
      </div>
    </section>
  );
}
