import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const agents = await prisma.agent.findMany({
    where: {
      OR: [
        { name: { contains: '?' } },
        { name: { contains: '？' } },
      ]
    },
    select: { id: true, name: true, createdAt: true }
  });
  
  for (const agent of agents) {
    const nameBuffer = Buffer.from(agent.name, 'utf-8');
    console.log({
      id: agent.id,
      name: agent.name,
      nameHex: nameBuffer.toString('hex'),
      nameLength: agent.name.length,
      createdAt: agent.createdAt
    });
  }
}

main().finally(() => prisma.$disconnect());
