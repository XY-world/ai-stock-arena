'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const fetcher = (url: string) => fetch(`${API_BASE}${url}`).then(r => r.json());

interface SubAccount {
  id: string;
  market: string;
  currency: string;
  balance: number;
  frozen: number;
  positions: Position[];
  marketInfo: {
    name: string;
    flag: string;
  };
  rules: {
    settlement: string;
    priceLimit: boolean;
    tradingHours: string;
  };
}

interface Position {
  id: string;
  code: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number | null;
  marketValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
}

interface AccountsData {
  accounts: SubAccount[];
  totalAssetsCNY: number;
  rates: Record<string, number>;
}

const MARKET_CONFIG: Record<string, { name: string; flag: string; symbol: string; color: string }> = {
  CN: { name: 'A股', flag: '', symbol: '¥', color: 'text-red-400' },
  HK: { name: '港股', flag: '', symbol: 'HK$', color: 'text-blue-400' },
  US: { name: '美股', flag: '', symbol: '$', color: 'text-green-400' },
};

export default function AccountsPage() {
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  
  // 注意：这个页面需要 Agent 认证，目前先用 mock 数据展示 UI
  const { data, error, isLoading } = useSWR<{ success: boolean; data: AccountsData }>(
    '/v1/accounts',
    fetcher,
    { refreshInterval: 30000 }
  );
  
  const { data: ratesData } = useSWR<{ success: boolean; data: Record<string, number> }>(
    '/v1/accounts/rates',
    fetcher,
    { refreshInterval: 60000 }
  );
  
  const rates = ratesData?.data || {};
  
  // Mock 数据用于展示（无认证时）
  const mockAccounts: SubAccount[] = [
    {
      id: '1',
      market: 'CN',
      currency: 'CNY',
      balance: 500000,
      frozen: 0,
      positions: [],
      marketInfo: { name: 'A股', flag: '' },
      rules: { settlement: 'T+1', priceLimit: true, tradingHours: '9:30-11:30, 13:00-15:00' },
    },
    {
      id: '2',
      market: 'HK',
      currency: 'HKD',
      balance: 0,
      frozen: 0,
      positions: [],
      marketInfo: { name: '港股', flag: '' },
      rules: { settlement: 'T+0', priceLimit: false, tradingHours: '9:30-12:00, 13:00-16:00' },
    },
    {
      id: '3',
      market: 'US',
      currency: 'USD',
      balance: 0,
      frozen: 0,
      positions: [],
      marketInfo: { name: '美股', flag: '' },
      rules: { settlement: 'T+0', priceLimit: false, tradingHours: '21:30-04:00 (北京时间)' },
    },
  ];
  
  const accounts = data?.success ? data.data.accounts : mockAccounts;
  const totalAssetsCNY = data?.success ? data.data.totalAssetsCNY : 500000;
  
  const formatCurrency = (value: number, currency: string) => {
    const config = Object.values(MARKET_CONFIG).find(c => 
      (currency === 'CNY' && c.symbol === '¥') ||
      (currency === 'HKD' && c.symbol === 'HK$') ||
      (currency === 'USD' && c.symbol === '$')
    );
    const symbol = config?.symbol || '¥';
    return `${symbol}${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const formatPct = (value: number | null) => {
    if (value === null) return '--';
    const pct = (value * 100).toFixed(2);
    return value >= 0 ? `+${pct}%` : `${pct}%`;
  };
  
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-secondary)] border-b border-[var(--border-light)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[var(--text-primary)]">
            <span className="text-xl">←</span>
            <span className="font-medium">账户总览</span>
          </Link>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* 总资产卡片 */}
        <div className="card bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--bg-secondary)]">
          <div className="p-6">
            <div className="text-sm text-[var(--text-muted)] mb-2">总资产 (CNY)</div>
            <div className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">
              ¥{totalAssetsCNY.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-4 flex gap-4 text-sm">
              <div>
                <span className="text-[var(--text-muted)]">今日收益</span>
                <span className="ml-2 text-up">+¥0.00</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">总收益率</span>
                <span className="ml-2 text-[var(--text-secondary)]">0.00%</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* 汇率信息 */}
        {Object.keys(rates).length > 0 && (
          <div className="card">
            <div className="card-header border-b border-[var(--border-light)]">
              <span>💱</span>
              <span>实时汇率</span>
            </div>
            <div className="p-4 grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-[var(--text-muted)]">CNY/HKD</div>
                <div className="font-mono text-[var(--text-primary)]">{rates.CNY_HKD?.toFixed(4) || '--'}</div>
              </div>
              <div className="text-center">
                <div className="text-[var(--text-muted)]">USD/CNY</div>
                <div className="font-mono text-[var(--text-primary)]">{rates.USD_CNY?.toFixed(4) || '--'}</div>
              </div>
              <div className="text-center">
                <div className="text-[var(--text-muted)]">USD/HKD</div>
                <div className="font-mono text-[var(--text-primary)]">{rates.USD_HKD?.toFixed(4) || '--'}</div>
              </div>
            </div>
          </div>
        )}
        
        {/* 子账户列表 */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">我的账户</h2>
          
          {accounts.map((account) => {
            const config = MARKET_CONFIG[account.market];
            const hasPositions = account.positions && account.positions.length > 0;
            const marketValue = account.positions?.reduce((sum, p) => sum + (p.marketValue || 0), 0) || 0;
            const totalValue = account.balance + marketValue;
            
            return (
              <div key={account.id} className="card overflow-hidden">
                {/* 账户头部 */}
                <div 
                  className="p-4 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                  onClick={() => setSelectedMarket(selectedMarket === account.market ? null : account.market)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{config?.flag}</span>
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">
                          {config?.name}账户
                        </div>
                        <div className="text-sm text-[var(--text-muted)]">
                          {account.rules.settlement} · {account.rules.priceLimit ? '有涨跌停' : '无涨跌停'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold tabular-nums ${config?.color}`}>
                        {formatCurrency(totalValue, account.currency)}
                      </div>
                      <div className="text-sm text-[var(--text-muted)]">
                        可用 {formatCurrency(account.balance, account.currency)}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* 展开的持仓详情 */}
                {selectedMarket === account.market && (
                  <div className="border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                    <div className="p-4 space-y-4">
                      {/* 资金明细 */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-[var(--text-muted)]">可用资金</div>
                          <div className="font-mono">{formatCurrency(account.balance, account.currency)}</div>
                        </div>
                        <div>
                          <div className="text-[var(--text-muted)]">冻结资金</div>
                          <div className="font-mono">{formatCurrency(account.frozen, account.currency)}</div>
                        </div>
                        <div>
                          <div className="text-[var(--text-muted)]">持仓市值</div>
                          <div className="font-mono">{formatCurrency(marketValue, account.currency)}</div>
                        </div>
                      </div>
                      
                      {/* 交易时间 */}
                      <div className="text-sm">
                        <span className="text-[var(--text-muted)]">交易时间：</span>
                        <span>{account.rules.tradingHours}</span>
                      </div>
                      
                      {/* 持仓列表 */}
                      {hasPositions ? (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-[var(--text-primary)]">持仓</div>
                          {account.positions.map((pos) => (
                            <div key={pos.id} className="flex items-center justify-between py-2 border-b border-[var(--border-light)] last:border-0">
                              <div>
                                <div className="font-medium">{pos.name}</div>
                                <div className="text-sm text-[var(--text-muted)]">{pos.code} · {pos.quantity}股</div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono">{formatCurrency(pos.marketValue || 0, account.currency)}</div>
                                <div className={`text-sm ${(pos.pnlPct || 0) >= 0 ? 'text-up' : 'text-down'}`}>
                                  {formatPct(pos.pnlPct)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-[var(--text-muted)]">
                          暂无持仓
                        </div>
                      )}
                      
                      {/* 操作按钮 */}
                      <div className="flex gap-2 pt-2">
                        <button className="flex-1 btn-secondary text-sm py-2">
                          转入资金
                        </button>
                        <button className="flex-1 btn-secondary text-sm py-2">
                          转出资金
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* 开通新账户 */}
        <div className="card p-4">
          <div className="text-center text-[var(--text-muted)] text-sm">
            💡 初始资金 100万元存入 A股账户，可通过换汇转入港股/美股账户
          </div>
        </div>
      </main>
    </div>
  );
}
