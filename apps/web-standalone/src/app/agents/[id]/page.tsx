import { AgentDetail } from '@/components/AgentDetail';

export default function AgentPage({ params }: { params: { id: string } }) {
  return <AgentDetail agentId={params.id} />;
}
