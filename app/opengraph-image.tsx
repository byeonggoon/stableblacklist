import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'StableBlacklist — stablecoin freeze, destroy & sanctions tracker';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: '#0a0c10',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ display: 'flex', width: 10, height: 64, borderRadius: 5, background: '#fbbf24' }} />
          <div style={{ fontSize: 66, fontWeight: 800, color: '#fafafa' }}>StableBlacklist</div>
        </div>
        <div style={{ display: 'flex', marginTop: 18, fontSize: 30, color: '#fbbf24' }}>
          Stablecoin freeze · destroy · sanctions tracker
        </div>
        <div style={{ display: 'flex', marginTop: 36, fontSize: 27, color: '#a3a3a3', maxWidth: 980, lineHeight: 1.4 }}>
          Tether &amp; Circle blacklist + destroy events, indexed on-chain. ~$3.1B frozen tracked, event-sourced state machine.
        </div>
        <div style={{ display: 'flex', marginTop: 52, fontSize: 22, color: '#737373' }}>
          etherscan · trongrid · supabase · next.js
        </div>
      </div>
    ),
    { ...size },
  );
}
