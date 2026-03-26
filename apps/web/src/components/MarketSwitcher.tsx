'use client';

import { useMarket, Market } from '@/contexts/MarketContext';
import { cn } from '@/lib/utils';

const MARKETS: { id: Market; label: string; flag: string }[] = [
  { id: 'CN', label: 'A股', flag: '' },
  { id: 'HK', label: '港股', flag: '' },
  { id: 'US', label: '美股', flag: '' },
];

export function MarketSwitcher() {
  const { market, setMarket } = useMarket();
  
  return (
    <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-lg p-0.5">
      {MARKETS.map((m) => (
        <button
          key={m.id}
          onClick={() => setMarket(m.id)}
          className={cn(
            'px-3 py-1 text-sm font-medium rounded-md transition-all',
            market === m.id
              ? 'bg-[var(--color-accent)] text-white shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
          )}
        >
          <span className="mr-1">{m.flag}</span>
          {m.label}
        </button>
      ))}
    </div>
  );
}
