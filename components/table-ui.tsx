'use client';

import { useState } from 'react';
import { programDesc } from '@/lib/sanctions/programs';
import type { Lang } from '@/lib/i18n';

/** OFAC 프로그램 코드 칩 + 즉시 뜨는 커스텀 설명 툴팁 (SanctionsTable·Cross-flagged 공용).
 *  position:fixed 로 테이블 overflow 에 잘리지 않게 함. */
export function ProgramChips({ programs, lang }: { programs?: string | null; lang: Lang }) {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  if (!programs) return null;
  const codes = programs.split(',').map((c) => c.trim()).filter(Boolean);
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {codes.map((code) => (
        <span key={code}
          onMouseEnter={(e) => setTip({ text: programDesc(code, lang), x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setTip(null)}
          className="cursor-help rounded bg-red-400/10 px-1 text-[10px] text-red-300/90 underline decoration-dotted decoration-red-300/40 underline-offset-2">
          {code}
        </span>
      ))}
      {tip && (
        <div className="pointer-events-none fixed z-50 max-w-[260px] -translate-y-full rounded-md border border-white/15 bg-neutral-900/95 px-2 py-1 text-[11px] leading-snug text-neutral-200 shadow-lg"
          style={{ left: tip.x + 8, top: tip.y - 8 }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

export function CopyButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* clipboard 거부됨 */ }
  };
  return (
    <button onClick={onCopy} title="copy address"
      className="shrink-0 text-neutral-600 transition hover:text-neutral-200" aria-label="copy address">
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" className="text-emerald-400" /></svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
    </button>
  );
}

export function PillGroup({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-white/10 p-0.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`rounded px-2 py-1 text-xs transition ${
            value === o.value ? 'bg-white/10 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
