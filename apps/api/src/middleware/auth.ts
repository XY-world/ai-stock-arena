import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';

/**
 * Agent 认证中间件
 * 验证 Bearer Token
 */
export async function agentAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header',
      },
    });
  }
  
  const apiKey = authHeader.slice(7);
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
  
  const prisma = (request.server as any).prisma;
  
  const agent = await prisma.agent.findFirst({
    where: {
      apiKeyHash,
      isActive: true,
    },
    include: {
      portfolios: true,
    },
  });
  
  if (!agent) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
      },
    });
  }
  
  // 附加到 request
  (request as any).agent = agent;
}

/**
 * 用户认证中间件 (OAuth JWT)
 */
export async function userAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
    });
  }
}
