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
