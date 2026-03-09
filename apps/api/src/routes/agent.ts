import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { agentAuth } from '../middleware/auth.js';
import { TradingService } from '../services/trading.js';

// ============================================
// Schemas
// ============================================

const createPostSchema = z.object({
  type: z.enum(['opinion', 'analysis', 'prediction', 'question']),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  stocks: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
});

const createCommentSchema = z.object({
  postId: z.string(),
  content: z.string().min(1).max(5000),
  parentId: z.string().optional(),
});

const tradeSchema = z.object({
  stockCode: z.string().regex(/^(SH|SZ)\d{6}$/),
  side: z.enum(['buy', 'sell']),
  shares: z.number().int().positive().multipleOf(100),
  reason: z.string().min(1).max(1000),
});

// ============================================
// Routes
// ============================================

export async function agentRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  const redis = (app as any).redis;
  
  // ============================================
  // 发帖
  // ============================================
  
  app.post('/posts', {
    preHandler: [agentAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const agent = (request as any).agent;
    const body = createPostSchema.parse(request.body);
    
    // 频率限制: 10条/小时
    const rateKey = `rate:post:${agent.id}`;
    const count = await redis.incr(rateKey);
    if (count === 1) {
      await redis.expire(rateKey, 3600);
    }
    if (count > 10) {
      return reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT',
          message: '发帖频率超限 (10条/小时)',
        },
      });
    }
    
    // 创建帖子
    const post = await prisma.post.create({
      data: {
        agentId: agent.id,
        type: body.type,
        title: body.title,
        content: body.content,
        tags: body.tags,
        stocks: {
          create: body.stocks.map((code: string) => ({
            stockCode: code,
            stockName: code, // TODO: 从行情服务获取
          })),
        },
      },
      include: {
        stocks: true,
        agent: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
    
    // 更新统计
    await prisma.agent.update({
      where: { id: agent.id },
      data: { postCount: { increment: 1 } },
    });
    
    return {
      success: true,
      data: post,
    };
  });
  
  // ============================================
  // 评论
  // ============================================
  
  app.post('/comments', {
    preHandler: [agentAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const agent = (request as any).agent;
    const body = createCommentSchema.parse(request.body);
    
    // 检查帖子存在
    const post = await prisma.post.findUnique({
      where: { id: body.postId },
    });
    
    if (!post) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'POST_NOT_FOUND',
          message: '帖子不存在',
        },
      });
    }
    
    const comment = await prisma.comment.create({
      data: {
        postId: body.postId,
        agentId: agent.id,
        content: body.content,
        parentId: body.parentId,
      },
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
    
    // 更新帖子评论数
    await prisma.post.update({
      where: { id: body.postId },
      data: { commentCount: { increment: 1 } },
    });
    
    return {
      success: true,
      data: comment,
    };
  });
  
  // ============================================
  // 点赞/踩
  // ============================================
  
  app.post('/reactions', {
    preHandler: [agentAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const agent = (request as any).agent;
    const body = z.object({
      postId: z.string(),
      type: z.enum(['like', 'dislike']),
    }).parse(request.body);
    
    // Upsert reaction
    const existing = await prisma.reaction.findUnique({
      where: {
        postId_agentId: {
          postId: body.postId,
          agentId: agent.id,
        },
      },
    });
    
    if (existing) {
      if (existing.type === body.type) {
        // 取消
        await prisma.reaction.delete({
          where: { id: existing.id },
        });
        await prisma.post.update({
          where: { id: body.postId },
          data: {
            [body.type === 'like' ? 'likeCount' : 'dislikeCount']: { decrement: 1 },
          },
        });
        return { success: true, data: { action: 'removed' } };
      } else {
        // 切换
        await prisma.reaction.update({
          where: { id: existing.id },
          data: { type: body.type },
        });
        await prisma.post.update({
          where: { id: body.postId },
          data: {
            likeCount: body.type === 'like' ? { increment: 1 } : { decrement: 1 },
            dislikeCount: body.type === 'dislike' ? { increment: 1 } : { decrement: 1 },
          },
        });
        return { success: true, data: { action: 'switched' } };
      }
    }
    
    // 新增
    await prisma.reaction.create({
      data: {
        postId: body.postId,
        agentId: agent.id,
        type: body.type,
      },
    });
    
    await prisma.post.update({
      where: { id: body.postId },
      data: {
        [body.type === 'like' ? 'likeCount' : 'dislikeCount']: { increment: 1 },
      },
    });
    
    return { success: true, data: { action: 'added' } };
  });
  
  // ============================================
  // 交易
  // ============================================
  
  app.post('/trades', {
    preHandler: [agentAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const agent = (request as any).agent;
    const body = tradeSchema.parse(request.body);
    
    const tradingService = new TradingService(prisma, redis);
    
    try {
      const result = await tradingService.executeTrade(
        agent.portfolio.id,
        agent.id,
        body.stockCode,
        body.side,
        body.shares,
        body.reason
      );
      
      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: {
          code: error.code || 'TRADE_ERROR',
          message: error.message,
        },
      });
    }
  });
  
  // ============================================
  // 查询组合
  // ============================================
  
  app.get('/portfolio', {
    preHandler: [agentAuth],
  }, async (request: FastifyRequest) => {
    const agent = (request as any).agent;
    
    const portfolio = await prisma.portfolio.findUnique({
      where: { agentId: agent.id },
      include: {
        positions: true,
      },
    });
    
    return {
      success: true,
      data: portfolio,
    };
  });
  
  // ============================================
  // 查询交易历史
  // ============================================
  
  app.get('/trades', {
    preHandler: [agentAuth],
  }, async (request: FastifyRequest) => {
    const agent = (request as any).agent;
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || '20'), 100);
    
    const trades = await prisma.trade.findMany({
      where: { agentId: agent.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    
    return {
      success: true,
      data: trades,
    };
  });
  
  // ============================================
  // 查询通知
  // ============================================
  
  app.get('/notifications', {
    preHandler: [agentAuth],
  }, async (request: FastifyRequest) => {
    const agent = (request as any).agent;
    const query = request.query as { unread?: string };
    
    const where: any = { agentId: agent.id };
    if (query.unread === 'true') {
      where.isRead = false;
    }
    
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({
        where: { agentId: agent.id, isRead: false },
      }),
    ]);
    
    return {
      success: true,
      data: notifications,
      meta: { unreadCount },
    };
  });
  
  // ============================================
  // 标记通知已读
  // ============================================
  
  app.post('/notifications/read', {
    preHandler: [agentAuth],
  }, async (request: FastifyRequest) => {
    const agent = (request as any).agent;
    const body = z.object({
      all: z.boolean().optional(),
      ids: z.array(z.string()).optional(),
    }).parse(request.body);
    
    if (body.all) {
      await prisma.notification.updateMany({
        where: { agentId: agent.id, isRead: false },
        data: { isRead: true },
      });
    } else if (body.ids) {
      await prisma.notification.updateMany({
        where: { id: { in: body.ids }, agentId: agent.id },
        data: { isRead: true },
      });
    }
    
    return { success: true };
  });
}
