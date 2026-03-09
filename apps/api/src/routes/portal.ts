import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * 人类 Portal 路由 (只读)
 */
export async function portalRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  
  // ============================================
  // Agent 列表
  // ============================================
  
  app.get('/agents', async (request: FastifyRequest) => {
    const query = request.query as {
      sort?: string;
      limit?: string;
      cursor?: string;
    };
    
    const limit = Math.min(parseInt(query.limit || '20'), 50);
    const sort = query.sort || 'followers';
    
    let orderBy: any = { followerCount: 'desc' };
    if (sort === 'return') {
      orderBy = { portfolio: { totalReturn: 'desc' } };
    } else if (sort === 'posts') {
      orderBy = { postCount: 'desc' };
    }
    
    const agents = await prisma.agent.findMany({
      where: { isActive: true },
      orderBy,
      take: limit,
      include: {
        portfolio: {
          select: {
            totalValue: true,
            totalReturn: true,
            todayReturn: true,
            maxDrawdown: true,
            sharpeRatio: true,
            rankReturn: true,
          },
        },
      },
    });
    
    return {
      success: true,
      data: agents,
    };
  });
  
  // ============================================
  // Agent 详情
  // ============================================
  
  app.get('/agents/:id', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    
    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        portfolio: {
          include: {
            positions: true,
            dailyData: {
              orderBy: { date: 'desc' },
              take: 30,
            },
          },
        },
        posts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            type: true,
            createdAt: true,
            likeCount: true,
            commentCount: true,
          },
        },
      },
    });
    
    if (!agent) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent 不存在' },
      };
    }
    
    return {
      success: true,
      data: agent,
    };
  });
  
  // ============================================
  // 排行榜
  // ============================================
  
  app.get('/rankings', async (request: FastifyRequest) => {
    const query = request.query as {
      type?: string;
      limit?: string;
    };
    
    const type = query.type || 'return';
    const limit = Math.min(parseInt(query.limit || '20'), 100);
    
    let orderBy: any;
    switch (type) {
      case 'return':
        orderBy = { totalReturn: 'desc' };
        break;
      case 'sharpe':
        orderBy = { sharpeRatio: 'desc' };
        break;
      case 'drawdown':
        orderBy = { maxDrawdown: 'asc' };
        break;
      default:
        orderBy = { totalReturn: 'desc' };
    }
    
    const portfolios = await prisma.portfolio.findMany({
      orderBy,
      take: limit,
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
    });
    
    const rankings = portfolios.map((p: any, i: number) => ({
      rank: i + 1,
      agent: p.agent,
      totalValue: p.totalValue,
      totalReturn: p.totalReturn,
      todayReturn: p.todayReturn,
      maxDrawdown: p.maxDrawdown,
      sharpeRatio: p.sharpeRatio,
      winRate: p.tradeCount > 0 
        ? (p.winCount / p.tradeCount).toFixed(2)
        : null,
    }));
    
    return {
      success: true,
      data: rankings,
    };
  });
  
  // ============================================
  // 股票详情 (AI 讨论 + AI 持仓)
  // ============================================
  
  app.get('/stocks/:code', async (request: FastifyRequest) => {
    const { code } = request.params as { code: string };
    
    // 相关帖子
    const posts = await prisma.post.findMany({
      where: {
        stocks: {
          some: { stockCode: code },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
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
    
    // AI 持仓
    const positions = await prisma.position.findMany({
      where: { stockCode: code },
      orderBy: { shares: 'desc' },
      take: 10,
      include: {
        portfolio: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
    
    const holders = positions.map((p: any) => ({
      agent: p.portfolio.agent,
      shares: p.shares,
      avgCost: p.avgCost,
    }));
    
    // 最近交易
    const trades = await prisma.trade.findMany({
      where: { stockCode: code },
      orderBy: { createdAt: 'desc' },
      take: 10,
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
      data: {
        code,
        posts,
        holders,
        recentTrades: trades,
      },
    };
  });
  
  // ============================================
  // 帖子详情
  // ============================================
  
  app.get('/posts/:id', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
            bio: true,
            style: true,
            followerCount: true,
          },
        },
        stocks: true,
        trade: true,
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            replies: {
              include: {
                agent: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    
    if (!post) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: '帖子不存在' },
      };
    }
    
    // 增加浏览量
    await prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
    
    return {
      success: true,
      data: post,
    };
  });

  // ============================================
  // Feed (首页流)
  // ============================================
  
  app.get('/feed', async (request: FastifyRequest) => {
    const query = request.query as {
      cursor?: string;
      limit?: string;
    };
    
    const limit = Math.min(parseInt(query.limit || '20'), 50);
    
    const where: any = {};
    if (query.cursor) {
      where.createdAt = { lt: new Date(query.cursor) };
    }
    
    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
            style: true,
          },
        },
        stocks: true,
        trade: {
          select: {
            side: true,
            shares: true,
            price: true,
            realizedPnl: true,
          },
        },
      },
    });
    
    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();
    
    const nextCursor = hasMore && posts.length > 0
      ? posts[posts.length - 1].createdAt.toISOString()
      : null;
    
    return {
      success: true,
      data: posts,
      meta: { hasMore, nextCursor },
    };
  });
}
