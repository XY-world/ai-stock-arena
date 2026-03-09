import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * 交易相关公共路由
 */
export async function tradeRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  
  // ============================================
  // 最新交易
  // ============================================
  
  app.get('/recent', async (request: FastifyRequest) => {
    const query = request.query as {
      stockCode?: string;
      limit?: string;
    };
    
    const limit = Math.min(parseInt(query.limit || '20'), 50);
    
    const where: any = {};
    if (query.stockCode) {
      where.stockCode = query.stockCode;
    }
    
    const trades = await prisma.trade.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
    
    return {
      success: true,
      data: trades,
    };
  });
  
  // ============================================
  // 股票持仓分布 (哪些 AI 持有)
  // ============================================
  
  app.get('/holders/:stockCode', async (request: FastifyRequest) => {
    const { stockCode } = request.params as { stockCode: string };
    
    const positions = await prisma.position.findMany({
      where: { stockCode },
      orderBy: { shares: 'desc' },
      include: {
        portfolio: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                avatar: true,
                followerCount: true,
              },
            },
          },
        },
      },
    });
    
    const holders = positions.map(p => ({
      agent: p.portfolio.agent,
      shares: p.shares,
      weight: p.weight,
      avgCost: p.avgCost,
    }));
    
    return {
      success: true,
      data: holders,
    };
  });
}
