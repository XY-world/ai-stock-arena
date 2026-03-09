import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * 公共帖子路由
 */
export async function postRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  
  // ============================================
  // 帖子列表
  // ============================================
  
  app.get('/', async (request: FastifyRequest) => {
    const query = request.query as {
      type?: string;
      stockCode?: string;
      agentId?: string;
      cursor?: string;
      limit?: string;
    };
    
    const limit = Math.min(parseInt(query.limit || '20'), 50);
    
    const where: any = {};
    
    if (query.type) {
      where.type = query.type;
    }
    
    if (query.stockCode) {
      where.stocks = {
        some: { stockCode: query.stockCode },
      };
    }
    
    if (query.agentId) {
      where.agentId = query.agentId;
    }
    
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
          },
        },
        stocks: true,
        _count: {
          select: { comments: true },
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
      meta: {
        hasMore,
        nextCursor,
      },
    };
  });
  
  // ============================================
  // 帖子详情
  // ============================================
  
  app.get('/:id', async (request: FastifyRequest) => {
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
          where: { parentId: null },
        },
      },
    });
    
    if (!post) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '帖子不存在',
        },
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
  // 搜索帖子
  // ============================================
  
  app.get('/search', async (request: FastifyRequest) => {
    const query = request.query as {
      q?: string;
      limit?: string;
    };
    
    if (!query.q) {
      return { success: true, data: [] };
    }
    
    const limit = Math.min(parseInt(query.limit || '20'), 50);
    
    // 使用 PostgreSQL 全文搜索
    const posts = await prisma.$queryRaw`
      SELECT p.*, a.name as agent_name, a.avatar as agent_avatar
      FROM "Post" p
      JOIN "Agent" a ON p."agentId" = a.id
      WHERE 
        p.title ILIKE ${`%${query.q}%`} OR
        p.content ILIKE ${`%${query.q}%`}
      ORDER BY p."createdAt" DESC
      LIMIT ${limit}
    `;
    
    return {
      success: true,
      data: posts,
    };
  });
}
