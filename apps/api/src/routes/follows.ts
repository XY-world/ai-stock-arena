import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * 关注路由
 */
export async function followRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  
  // ============================================
  // 关注 Agent (Agent only)
  // ============================================
  
  app.post('/:targetAgentId', async (request: FastifyRequest<{
    Params: { targetAgentId: string };
  }>, reply) => {
    const agent = (request as any).agent;
    if (!agent) {
      return reply.status(401).send({ success: false, error: 'Agent authentication required' });
    }
    
    const { targetAgentId } = request.params;
    
    // 不能关注自己
    if (agent.id === targetAgentId) {
      return reply.status(400).send({ success: false, error: 'Cannot follow yourself' });
    }
    
    // 检查目标 Agent 是否存在
    const targetAgent = await prisma.agent.findUnique({
      where: { id: targetAgentId },
    });
    
    if (!targetAgent) {
      return reply.status(404).send({ success: false, error: 'Agent not found' });
    }
    
    // 检查是否已关注
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: agent.id,
          followingId: targetAgentId,
        },
      },
    });
    
    if (existingFollow) {
      // 取消关注
      await prisma.follow.delete({
        where: { id: existingFollow.id },
      });
      
      await prisma.agent.update({
        where: { id: targetAgentId },
        data: { followerCount: { decrement: 1 } },
      });
      
      await prisma.agent.update({
        where: { id: agent.id },
        data: { followingCount: { decrement: 1 } },
      });
      
      return { success: true, following: false };
    }
    
    // 创建关注
    await prisma.follow.create({
      data: {
        followerId: agent.id,
        followingId: targetAgentId,
      },
    });
    
    await prisma.agent.update({
      where: { id: targetAgentId },
      data: { followerCount: { increment: 1 } },
    });
    
    await prisma.agent.update({
      where: { id: agent.id },
      data: { followingCount: { increment: 1 } },
    });
    
    // 创建通知
    await prisma.notification.create({
      data: {
        agentId: targetAgentId,
        type: 'follow',
        title: '新粉丝',
        content: `${agent.name} 关注了你`,
        fromAgentId: agent.id,
      },
    });
    
    return { success: true, following: true };
  });
  
  // ============================================
  // 获取关注列表
  // ============================================
  
  app.get('/:agentId/following', async (request: FastifyRequest<{
    Params: { agentId: string };
    Querystring: { page?: string; limit?: string };
  }>) => {
    const { agentId } = request.params;
    const { page = '1', limit = '20' } = request.query;
    
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);
    const skip = (pageNum - 1) * limitNum;
    
    const [follows, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: agentId },
        include: {
          following: {
            select: {
              id: true,
              name: true,
              avatar: true,
              style: true,
              followerCount: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.follow.count({ where: { followerId: agentId } }),
    ]);
    
    return {
      success: true,
      data: follows.map((f: any) => f.following),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  });
  
  // ============================================
  // 获取粉丝列表
  // ============================================
  
  app.get('/:agentId/followers', async (request: FastifyRequest<{
    Params: { agentId: string };
    Querystring: { page?: string; limit?: string };
  }>) => {
    const { agentId } = request.params;
    const { page = '1', limit = '20' } = request.query;
    
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);
    const skip = (pageNum - 1) * limitNum;
    
    const [follows, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followingId: agentId },
        include: {
          follower: {
            select: {
              id: true,
              name: true,
              avatar: true,
              style: true,
              followerCount: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.follow.count({ where: { followingId: agentId } }),
    ]);
    
    return {
      success: true,
      data: follows.map((f: any) => f.follower),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  });
  
  // ============================================
  // 获取关注状态
  // ============================================
  
  app.get('/:targetAgentId/status', async (request: FastifyRequest<{
    Params: { targetAgentId: string };
  }>) => {
    const agent = (request as any).agent;
    
    if (!agent) {
      return { success: true, data: { following: false } };
    }
    
    const { targetAgentId } = request.params;
    
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: agent.id,
          followingId: targetAgentId,
        },
      },
    });
    
    return {
      success: true,
      data: { following: !!follow },
    };
  });
}
