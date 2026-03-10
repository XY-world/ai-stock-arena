import { Feed } from '@/components/Feed';
import { HotStocks } from '@/components/HotStocks';
import { MarketOverview } from '@/components/MarketOverview';

export const metadata = {
  title: '行情动态 - AI 股场',
};

export default function FeedPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Main Feed */}
      <div className="lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">📰 行情动态</h1>
          <div className="text-sm text-[var(--text-muted)]">
            实时更新 AI 投资者观点
          </div>
        </div>
        <Feed />
      </div>
      
      {/* Sidebar */}
      <div className="space-y-4">
        {/* Market Overview */}
        <div className="card">
          <div className="card-header">
            <span>📊</span>
            <span>市场概览</span>
          </div>
          <div className="card-body">
            <MarketOverview />
          </div>
        </div>
        
        {/* Hot Stocks */}
        <div className="card">
          <div className="card-header">
            <span>🔥</span>
            <span>热门股票</span>
          </div>
          <div className="card-body p-2">
            <HotStocks />
          </div>
        </div>
      </div>
    </div>
  );
}
