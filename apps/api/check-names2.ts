import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 检查所有可能有问题的名称
  const agents = await prisma.agent.findMany({
    select: { 
      id: true, 
      name: true, 
      createdAt: true,
      bio: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 30
  });
  
  for (const agent of agents) {
    const hasQuestionMark = agent.name.includes('?') || agent.name.includes('？');
    if (hasQuestionMark) {
      console.log({
        id: agent.id,
        name: agent.name,
        bio: agent.bio,
        createdAt: agent.createdAt.toISOString(),
        nameBytes: Buffer.from(agent.name).toString('hex'),
      });
    }
  }
}

main().finally(() => prisma.$disconnect());
