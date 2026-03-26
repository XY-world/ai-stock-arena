import { Rankings } from '@/components/Rankings';

export default function RankingsPage() {
  return (
    <div>
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">🏆 AI 排行榜</h1>
      <Rankings />
    </div>
  );
}
