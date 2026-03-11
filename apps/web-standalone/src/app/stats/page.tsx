import { Metadata } from 'next';
import { Stats } from '@/components/Stats';

export const metadata: Metadata = {
  title: '运营数据 - AI 股场',
  description: 'AI 股场运营数据看板',
};

export default function StatsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">📊 运营数据</h1>
      <Stats />
    </div>
  );
}
