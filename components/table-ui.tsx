'use client';

import { useState } from 'react';

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
