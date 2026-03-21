import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

import { agentRoutes } from './routes/agent.js';
import { postRoutes } from './routes/posts.js';
import { tradeRoutes } from './routes/trades.js';
import { marketRoutes } from './routes/market.js';
import { portalRoutes } from './routes/portal.js';
import { ownerRoutes } from './routes/owner.js';
import { authRoutes } from './routes/auth.js';
import { registerRoutes } from './routes/register.js';
import { feedbackRoutes } from './routes/feedback.js';
import { statsRoutes } from './routes/stats.js';
import { searchRoutes } from './routes/search.js';
import { likeRoutes } from './routes/likes.js';
import { followRoutes } from './routes/follows.js';
import { notificationRoutes } from './routes/notifications.js';
import { subAccountRoutes } from './routes/subaccount.js';
import { incrementApiCall, incrementPageView } from './services/stats.js';

// ============================================
// Initialize
// ============================================

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const app = Fastify({
  logger: true,
});

// ============================================
// Plugins
// ============================================

await app.register(cors, {
  origin: true,
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  redis,
});

await app.register(jwt, {
  secret: process.env.API_SECRET || 'dev-secret-change-in-production',
});

// ============================================
// Decorators
// ============================================

app.decorate('prisma', prisma);
app.decorate('redis', redis);

// ============================================
// Stats Hook - 统计 API 调用
// ============================================

app.addHook('onResponse', async (request, reply) => {
  const url = request.url;
  
  // 忽略 health check 和静态资源
  if (url === '/health' || url.startsWith('/_next')) {
    return;
  }
  
  // API 调用统计 (v1 路由)
  if (url.startsWith('/v1/')) {
    // 提取路由前缀，如 /v1/market/hot -> /v1/market
    const match = url.match(/^\/v1\/([^/?]+)/);
    const routePrefix = match ? `/v1/${match[1]}` : '/v1';
    incrementApiCall(routePrefix).catch(() => {});
  }
});

// ============================================
// Health Check
// ============================================

app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// ============================================
// Routes
// ============================================

// Auth
await app.register(authRoutes, { prefix: '/v1/auth' });

// Agent 注册
await app.register(registerRoutes, { prefix: '/v1/register' });

// Owner (管理 Agent)
await app.register(ownerRoutes, { prefix: '/v1/owner' });

// Agent API (AI 使用)
await app.register(agentRoutes, { prefix: '/v1/agent' });

// Portal API (人类使用)
await app.register(portalRoutes, { prefix: '/v1/portal' });

// 公共 API
await app.register(postRoutes, { prefix: '/v1/posts' });
await app.register(tradeRoutes, { prefix: '/v1/trades' });
await app.register(marketRoutes, { prefix: '/v1/market' });
await app.register(feedbackRoutes, { prefix: '/v1/feedback' });
await app.register(statsRoutes, { prefix: '/v1/stats' });
await app.register(searchRoutes, { prefix: '/v1/search' });
await app.register(likeRoutes, { prefix: '/v1/likes' });
await app.register(followRoutes, { prefix: '/v1/follows' });
await app.register(notificationRoutes, { prefix: '/v1/notifications' });

// 子账户 (富途风格)
await app.register(async (instance) => {
  await subAccountRoutes(instance, prisma);
}, { prefix: '/v1/accounts' });

// ============================================
// Start
// ============================================

const start = async () => {
  try {
    const port = parseInt(process.env.API_PORT || '3000');
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 API server running on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

// ============================================
// Graceful Shutdown
// ============================================

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
