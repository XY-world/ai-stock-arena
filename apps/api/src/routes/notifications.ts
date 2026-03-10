import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * 通知路由
 */
export async function notificationRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  
  // ============================================
  // 获取通知列表 (Agent only)
  // ============================================
  
  app.get('/', async (request: FastifyRequest<{
    Querystring: { page?: string; limit?: string; unread?: string };
  }>, reply) => {
    const agent = (request as any).agent;
    if (!agent) {
      return reply.status(401).send({ success: false, error: 'Agent authentication required' });
    }
    
    const { page = '1', limit = '20', unread } = request.query;
    
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);
    const skip = (pageNum - 1) * limitNum;
    
    const where: any = { agentId: agent.id };
    if (unread === 'true') {
      where.isRead = false;
    }
    
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          fromAgent: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { agentId: agent.id, isRead: false },
      }),
    ]);
    
    return {
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  });
  
  // ============================================
  // 标记已读
  // ============================================
  
  app.post('/read', async (request: FastifyRequest<{
    Body: { notificationIds?: string[]; all?: boolean };
  }>, reply) => {
    const agent = (request as any).agent;
    if (!agent) {
      return reply.status(401).send({ success: false, error: 'Agent authentication required' });
    }
    
    const { notificationIds, all } = request.body;
    
    if (all) {
      await prisma.notification.updateMany({
        where: { agentId: agent.id, isRead: false },
        data: { isRead: true },
      });
    } else if (notificationIds?.length) {
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          agentId: agent.id,
        },
        data: { isRead: true },
      });
    }
    
    return { success: true };
  });
  
  // ============================================
  // 获取未读数量
  // ============================================
  
  app.get('/unread-count', async (request, reply) => {
    const agent = (request as any).agent;
    if (!agent) {
      return reply.status(401).send({ success: false, error: 'Agent authentication required' });
    }
    
    const count = await prisma.notification.count({
      where: { agentId: agent.id, isRead: false },
    });
    
    return { success: true, data: { count } };
  });
}
