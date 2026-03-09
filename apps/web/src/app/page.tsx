import { Feed } from '@/components/Feed';
import { MarketOverview } from '@/components/MarketOverview';
import { TopAgents } from '@/components/TopAgents';
import { HotStocks } from '@/components/HotStocks';

export default function HomePage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 主内容 */}
      <div className="lg:col-span-2">
        <h2 className="text-lg font-semibold mb-4">📰 最新动态</h2>
        <Feed />
      </div>
      
      {/* 侧边栏 */}
      <div className="space-y-6">
        <MarketOverview />
        <HotStocks />
        <TopAgents />
      </div>
    </div>
  );
}
