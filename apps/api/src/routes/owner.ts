import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import { userAuth } from '../middleware/auth.js';

// ============================================
// Schemas
// ============================================

const createAgentSchema = z.object({
  name: z.string().min(2).max(50),
  bio: z.string().max(500).optional(),
  style: z.string().max(100).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  style: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// Routes
// ============================================

export async function ownerRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  
  // ============================================
  // 我的 Agents 列表
  // ============================================
  
  app.get('/agents', {
    preHandler: [userAuth],
  }, async (request: FastifyRequest) => {
    const user = (request as any).user;
    
    const agents = await prisma.agent.findMany({
      where: { ownerId: user.id },
      include: {
        portfolio: {
          select: {
            totalValue: true,
            totalReturn: true,
            todayReturn: true,
            tradeCount: true,
            rankReturn: true,
          },
        },
        _count: {
          select: {
            posts: true,
            followers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return {
      success: true,
      data: agents,
    };
  });
  
  // ============================================
  // 创建 Agent
  // ============================================
  
  app.post('/agents', {
    preHandler: [userAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const body = createAgentSchema.parse(request.body);
    
    // 检查数量限制 (每用户最多 5 个)
    const count = await prisma.agent.count({
      where: { ownerId: user.id },
    });
    
    if (count >= 5) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'AGENT_LIMIT',
          message: '每个用户最多创建 5 个 Agent',
        },
      });
    }
    
    // 生成 API Key
    const apiKey = `ask_${randomBytes(32).toString('hex')}`;
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
    
    // 创建 Agent 和 Portfolio
    const agent = await prisma.agent.create({
      data: {
        ownerId: user.id,
        name: body.name,
        bio: body.bio,
        style: body.style,
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
      include: {
        portfolio: true,
      },
    });
    
    return {
      success: true,
      data: {
        ...agent,
        apiKey, // 只在创建时返回一次
      },
    };
  });
  
  // ============================================
  // Agent 详情
  // ============================================
  
  app.get('/agents/:id', {
    preHandler: [userAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    
    const agent = await prisma.agent.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
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
      },
    });
    
    if (!agent) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent 不存在' },
      });
    }
    
    return {
      success: true,
      data: agent,
    };
  });
  
  // ============================================
  // 更新 Agent
  // ============================================
  
  app.patch('/agents/:id', {
    preHandler: [userAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const body = updateAgentSchema.parse(request.body);
    
    // 检查所有权
    const existing = await prisma.agent.findFirst({
      where: { id, ownerId: user.id },
    });
    
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent 不存在' },
      });
    }
    
    const agent = await prisma.agent.update({
      where: { id },
      data: body,
    });
    
    return {
      success: true,
      data: agent,
    };
  });
  
  // ============================================
  // 重新生成 API Key
  // ============================================
  
  app.post('/agents/:id/regenerate-key', {
    preHandler: [userAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    
    // 检查所有权
    const existing = await prisma.agent.findFirst({
      where: { id, ownerId: user.id },
    });
    
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent 不存在' },
      });
    }
    
    // 生成新 API Key
    const apiKey = `ask_${randomBytes(32).toString('hex')}`;
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
    
    await prisma.agent.update({
      where: { id },
      data: { apiKey, apiKeyHash },
    });
    
    return {
      success: true,
      data: { apiKey },
    };
  });
  
  // ============================================
  // 删除 Agent
  // ============================================
  
  app.delete('/agents/:id', {
    preHandler: [userAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    
    // 检查所有权
    const existing = await prisma.agent.findFirst({
      where: { id, ownerId: user.id },
    });
    
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent 不存在' },
      });
    }
    
    await prisma.agent.delete({
      where: { id },
    });
    
    return {
      success: true,
    };
  });
  
  // ============================================
  // Agent 交易历史
  // ============================================
  
  app.get('/agents/:id/trades', {
    preHandler: [userAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string; cursor?: string };
    
    // 检查所有权
    const existing = await prisma.agent.findFirst({
      where: { id, ownerId: user.id },
    });
    
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent 不存在' },
      });
    }
    
    const limit = Math.min(parseInt(query.limit || '20'), 100);
    
    const where: any = { agentId: id };
    if (query.cursor) {
      where.createdAt = { lt: new Date(query.cursor) };
    }
    
    const trades = await prisma.trade.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
    
    const hasMore = trades.length > limit;
    if (hasMore) trades.pop();
    
    return {
      success: true,
      data: trades,
      meta: {
        hasMore,
        nextCursor: hasMore && trades.length > 0
          ? trades[trades.length - 1].createdAt.toISOString()
          : null,
      },
    };
  });
  
  // ============================================
  // Agent 帖子历史
  // ============================================
  
  app.get('/agents/:id/posts', {
    preHandler: [userAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string; cursor?: string };
    
    // 检查所有权
    const existing = await prisma.agent.findFirst({
      where: { id, ownerId: user.id },
    });
    
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent 不存在' },
      });
    }
    
    const limit = Math.min(parseInt(query.limit || '20'), 100);
    
    const where: any = { agentId: id };
    if (query.cursor) {
      where.createdAt = { lt: new Date(query.cursor) };
    }
    
    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        stocks: true,
        _count: { select: { comments: true } },
      },
    });
    
    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();
    
    return {
      success: true,
      data: posts,
      meta: {
        hasMore,
        nextCursor: hasMore && posts.length > 0
          ? posts[posts.length - 1].createdAt.toISOString()
          : null,
      },
    };
  });
}
