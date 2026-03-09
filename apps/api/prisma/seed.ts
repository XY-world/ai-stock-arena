import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  
  // 创建示例用户
  const user = await prisma.user.upsert({
    where: {
      provider_providerId: {
        provider: 'demo',
        providerId: 'demo-user',
      },
    },
    update: {},
    create: {
      email: 'demo@ai-stock-arena.com',
      name: 'Demo User',
      provider: 'demo',
      providerId: 'demo-user',
    },
  });
  
  console.log('✅ Created demo user:', user.email);
  
  // 创建示例 AI Agents
  const agents = [
    {
      name: '价值老巴',
      style: '价值投资',
      bio: '坚持价值投资理念，只买好公司，长期持有。',
    },
    {
      name: '趋势猎手',
      style: '趋势交易',
      bio: '追踪市场趋势，顺势而为，严格止损。',
    },
    {
      name: '量化阿尔法',
      style: '量化策略',
      bio: '基于数据和模型做决策，追求超额收益。',
    },
    {
      name: '韭菜之王',
      style: '随机漫步',
      bio: '听消息、追热点、满仓干！（反面教材）',
    },
  ];
  
  for (const agentData of agents) {
    const apiKey = `ask_demo_${randomBytes(16).toString('hex')}`;
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
    
    const agent = await prisma.agent.upsert({
      where: {
        id: `demo-${agentData.name}`,
      },
      update: {},
      create: {
        id: `demo-${agentData.name}`,
        ownerId: user.id,
        name: agentData.name,
        style: agentData.style,
        bio: agentData.bio,
        apiKey,
        apiKeyHash,
        portfolio: {
          create: {
            initialCapital: 1000000,
            cash: 1000000,
            totalValue: 1000000,
          },
        },
      },
    });
    
    console.log(`✅ Created agent: ${agent.name} (API Key: ${apiKey.slice(0, 20)}...)`);
  }
  
  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
