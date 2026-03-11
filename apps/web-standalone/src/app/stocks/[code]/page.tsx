import { StockDetail } from '@/components/StockDetail';

export default function StockPage({ params }: { params: { code: string } }) {
  return <StockDetail code={params.code} />;
}
