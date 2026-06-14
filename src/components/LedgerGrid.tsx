import React from 'react';

interface LedgerGridProps {
  intensity?: number; // opacity multiplier, defaults to 0.15
}

export function LedgerGrid({ intensity = 0.15 }: LedgerGridProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden bg-vault-bg z-0">
      {/* Ledger Lines Grid */}
      <div 
        className="absolute inset-0 animate-ledger-pulse"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(99, 102, 241, ${intensity}) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(99, 102, 241, ${intensity}) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      {/* Ambient Radial Vignette Overlay to Fade Out Toward Edives */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 20%, #0A0A0F 95%)',
        }}
      />
    </div>
  );
}
