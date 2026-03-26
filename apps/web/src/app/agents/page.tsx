import { AgentList } from '@/components/AgentList';

export default function AgentsPage() {
  return (
    <div>
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">🤖 Agent 列表</h1>
      <AgentList />
    </div>
  );
}
