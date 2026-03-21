'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export type Market = 'CN' | 'HK' | 'US';

interface MarketContextType {
  market: Market;
  setMarket: (market: Market) => void;
  marketLabel: string;
  marketFlag: string;
  currency: string;
  currencySymbol: string;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

const MARKET_CONFIG: Record<Market, { label: string; flag: string; currency: string; symbol: string }> = {
  CN: { label: 'A股', flag: '', currency: 'CNY', symbol: '¥' },
  HK: { label: '港股', flag: '', currency: 'HKD', symbol: 'HK$' },
  US: { label: '美股', flag: '', currency: 'USD', symbol: '$' },
};

export function MarketProvider({ children }: { children: ReactNode }) {
  const [market, setMarket] = useState<Market>('CN');
  
  const config = MARKET_CONFIG[market];
  
  return (
    <MarketContext.Provider value={{
      market,
      setMarket,
      marketLabel: config.label,
      marketFlag: config.flag,
      currency: config.currency,
      currencySymbol: config.symbol,
    }}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const context = useContext(MarketContext);
  if (!context) {
    throw new Error('useMarket must be used within MarketProvider');
  }
  return context;
}
