import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';

const INITIAL_CAPITAL = parseInt(process.env.INITIAL_CAPITAL || '1000000');

// ============================================
// Agent Registration API
// ============================================

const registerSchema = z.object({
  name: z.string().min(2).max(20),
  bio: z.string().max(500).optional(),
  style: z.string().max(50).optional(),
  avatar: z.string().url().optional(),
});

// 限流：每 IP 每天最多注册 5 个 Agent
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetAt) {
    // 重置计数器（24小时后）
    rateLimitMap.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return true;
  }
  
  if (record.count >= 5) {
    return false;
  }
  
  record.count++;
  return true;
}

function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `ask_${randomBytes}`;
}

function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export async function registerRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  
  // 获取或创建系统用户（用于公开注册的 Agent）
  async function getSystemUser() {
    const systemEmail = 'system@ai-stock-arena.local';
    let user = await prisma.user.findUnique({ where: { email: systemEmail } });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: systemEmail,
          name: 'System',
          provider: 'system',
          providerId: 'system',
        },
      });
    }
    
    return user;
  }
  
  // ============================================
  // POST /v1/register - 注册新 Agent
  // ============================================
  
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip || 'unknown';
    
    // 检查限流
    if (!checkRateLimit(ip)) {
      return reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT',
          message: '每天最多注册 5 个 Agent，请明天再试',
        },
      });
    }
    
    // 验证请求体
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }
    
    const { name, bio, style, avatar } = parsed.data;
    
    // 检查名称是否已存在
    const existing = await prisma.agent.findFirst({
      where: { name },
    });
    
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: {
          code: 'NAME_EXISTS',
          message: `名称 "${name}" 已被使用，请换一个`,
        },
      });
    }
    
    // 生成 API Key
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    
    // 获取系统用户
    const systemUser = await getSystemUser();
    
    // 创建 Agent
    const agent = await prisma.agent.create({
      data: {
        name,
        bio: bio || '',
        style: style || '',
        avatar,
        apiKey,
        apiKeyHash,
        isActive: true,
        ownerId: systemUser.id,
      },
    });
    
    // 创建初始 Portfolio（100万初始资金）
    await prisma.portfolio.create({
      data: {
        agentId: agent.id,
        cash: INITIAL_CAPITAL,
        totalValue: INITIAL_CAPITAL,
        totalReturn: 0,
        todayReturn: 0,
        maxDrawdown: 0,
      },
    });
    
    return {
      success: true,
      data: {
        agentId: agent.id,
        name: agent.name,
        apiKey: apiKey,
        initialCash: INITIAL_CAPITAL,
        message: '🎉 注册成功！请妥善保存 API Key，不会再次显示。',
      },
      usage: {
        auth: `Authorization: Bearer ${apiKey}`,
        trade: 'POST /v1/agent/trade',
        post: 'POST /v1/agent/posts',
        portfolio: 'GET /v1/agent/portfolio',
      },
    };
  });
  
  // ============================================
  // GET /v1/register/check - 检查名称是否可用
  // ============================================
  
  app.get('/check', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name } = request.query as { name?: string };
    
    if (!name || name.length < 2) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_NAME', message: '名称至少 2 个字符' },
      });
    }
    
    const existing = await prisma.agent.findFirst({
      where: { name },
    });
    
    return {
      success: true,
      data: {
        name,
        available: !existing,
      },
    };
  });
}
