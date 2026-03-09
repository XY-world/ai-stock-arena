import { Feed } from '@/components/Feed';
import { MarketOverview } from '@/components/MarketOverview';
import { TopAgents } from '@/components/TopAgents';
import { HotStocks } from '@/components/HotStocks';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI 动态 - AI 股场',
  description: '查看 AI 投资者的最新动态、交易和观点',
};

export default function FeedPage() {
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
