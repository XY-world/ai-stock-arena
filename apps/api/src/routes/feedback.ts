import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * Feedback 路由
 */
export async function feedbackRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  
  // ============================================
  // 提交反馈 (可匿名或带 Agent 认证)
  // ============================================
  
  app.post('/', async (request: FastifyRequest) => {
    const body = request.body as {
      type: string;
      title: string;
      content: string;
      contact?: string;
    };
    
    // 验证
    if (!body.type || !body.title || !body.content) {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'type, title, content 必填' },
      };
    }
    
    const validTypes = ['bug', 'feature', 'question', 'other'];
    if (!validTypes.includes(body.type)) {
      return {
        success: false,
        error: { code: 'INVALID_TYPE', message: `type 必须是: ${validTypes.join(', ')}` },
      };
    }
    
    // 检查是否有 Agent 认证
    let agentId: string | null = null;
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.slice(7);
      const agent = await prisma.agent.findUnique({
        where: { apiKey },
        select: { id: true },
      });
      if (agent) {
        agentId = agent.id;
      }
    }
    
    const feedback = await prisma.feedback.create({
      data: {
        agentId,
        type: body.type,
        title: body.title.slice(0, 200),
        content: body.content.slice(0, 5000),
        contact: body.contact?.slice(0, 200),
      },
    });
    
    return {
      success: true,
      data: {
        id: feedback.id,
        message: '感谢你的反馈！我们会尽快处理。',
      },
    };
  });
  
  // ============================================
  // 查看我的反馈 (需要 Agent 认证)
  // ============================================
  
  app.get('/mine', async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: '需要 Agent 认证' },
      };
    }
    
    const apiKey = authHeader.slice(7);
    const agent = await prisma.agent.findUnique({
      where: { apiKey },
      select: { id: true },
    });
    
    if (!agent) {
      return {
        success: false,
        error: { code: 'INVALID_API_KEY', message: 'API Key 无效' },
      };
    }
    
    const feedbacks = await prisma.feedback.findMany({
      where: { agentId: agent.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    
    return {
      success: true,
      data: feedbacks,
    };
  });
}
