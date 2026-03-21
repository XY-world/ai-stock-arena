/**
 * 子账户 API 路由
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createSubAccountService } from '../services/subaccount';
import { getAllRates } from '../services/exchange';

interface AuthRequest extends FastifyRequest {
  agent?: { id: string; name: string };
}

export async function subAccountRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const service = createSubAccountService(prisma);

  // ============================================
  // 获取所有子账户
  // ============================================
  app.get('/', async (request: AuthRequest) => {
    const agentId = request.agent?.id;
    if (!agentId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } };
    }

    try {
      const data = await service.getSubAccounts(agentId);
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: { code: 'ERROR', message: error.message } };
    }
  });

  // ============================================
  // 开通子账户
  // ============================================
  app.post('/open', async (request: AuthRequest) => {
    const agentId = request.agent?.id;
    if (!agentId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } };
    }

    const { market } = request.body as { market: string };
    if (!market || !['CN', 'HK', 'US'].includes(market)) {
      return { success: false, error: { code: 'INVALID_MARKET', message: '无效的市场' } };
    }

    try {
      const account = await service.openSubAccount(agentId, market as any);
      return { success: true, data: account };
    } catch (error: any) {
      return { success: false, error: { code: 'ERROR', message: error.message } };
    }
  });

  // ============================================
  // 换汇转账
  // ============================================
  app.post('/transfer', async (request: AuthRequest) => {
    const agentId = request.agent?.id;
    if (!agentId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } };
    }

    const { fromMarket, toMarket, amount } = request.body as {
      fromMarket: string;
      toMarket: string;
      amount: number;
    };

    if (!fromMarket || !toMarket || !amount) {
      return { success: false, error: { code: 'INVALID_PARAMS', message: '参数不完整' } };
    }

    if (amount <= 0) {
      return { success: false, error: { code: 'INVALID_AMOUNT', message: '金额必须大于0' } };
    }

    try {
      const result = await service.transfer(agentId, fromMarket as any, toMarket as any, amount);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: { code: 'ERROR', message: error.message } };
    }
  });

  // ============================================
  // 获取实时汇率
  // ============================================
  app.get('/rates', async () => {
    try {
      const rates = await getAllRates(prisma);
      return { success: true, data: rates };
    } catch (error: any) {
      return { success: false, error: { code: 'ERROR', message: error.message } };
    }
  });

  // ============================================
  // 获取转账记录
  // ============================================
  app.get('/transfers', async (request: AuthRequest) => {
    const agentId = request.agent?.id;
    if (!agentId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } };
    }

    const { limit = 20 } = request.query as { limit?: number };

    try {
      const transfers = await prisma.transfer.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
      });
      return { success: true, data: transfers };
    } catch (error: any) {
      return { success: false, error: { code: 'ERROR', message: error.message } };
    }
  });

  // ============================================
  // 获取子账户详情
  // ============================================
  app.get('/:market', async (request: AuthRequest) => {
    const agentId = request.agent?.id;
    if (!agentId) {
      return { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } };
    }

    const { market } = request.params as { market: string };

    try {
      const account = await prisma.subAccount.findUnique({
        where: { agentId_market: { agentId, market: market.toUpperCase() } },
        include: {
          positions: {
            orderBy: { marketValue: 'desc' },
          },
          trades: {
            orderBy: { tradeTime: 'desc' },
            take: 20,
          },
        },
      });

      if (!account) {
        return { success: false, error: { code: 'NOT_FOUND', message: '账户未开通' } };
      }

      return {
        success: true,
        data: {
          ...account,
          rules: service.getTradingRules(market.toUpperCase() as any),
        },
      };
    } catch (error: any) {
      return { success: false, error: { code: 'ERROR', message: error.message } };
    }
  });
}
