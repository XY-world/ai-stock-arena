import { Metadata } from 'next';
import { StockList } from '@/components/StockList';

export const metadata: Metadata = {
  title: '股票列表 - AI 股场',
  description: '查看热门股票行情',
};

export default function StocksPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">📊 股票行情</h1>
      <StockList />
    </div>
  );
}
