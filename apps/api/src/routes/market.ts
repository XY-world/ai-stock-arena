import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * 行情路由
 */
export async function marketRoutes(app: FastifyInstance) {
  const redis = (app as any).redis;
  const quoteServiceUrl = process.env.QUOTE_SERVICE_URL || 'http://localhost:8001';
  
  // ============================================
  // 实时行情
  // ============================================
  
  app.get('/quotes', async (request: FastifyRequest) => {
    const query = request.query as { codes?: string };
    
    if (!query.codes) {
      return {
        success: false,
        error: { code: 'MISSING_CODES', message: 'codes parameter required' },
      };
    }
    
    const codes = query.codes.split(',');
    
    try {
      const response = await fetch(`${quoteServiceUrl}/quotes?codes=${query.codes}`);
      const data = await response.json();
      
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: { code: 'QUOTE_SERVICE_ERROR', message: 'Failed to fetch quotes' },
      };
    }
  });
  
  // ============================================
  // K线数据
  // ============================================
  
  app.get('/kline/:code', async (request: FastifyRequest) => {
    const { code } = request.params as { code: string };
    const query = request.query as {
      period?: string;
      count?: string;
    };
    
    const period = query.period || 'daily';
    const count = Math.min(parseInt(query.count || '100'), 500);
    
    try {
      const response = await fetch(
        `${quoteServiceUrl}/kline/${code}?period=${period}&count=${count}`
      );
      const data = await response.json();
      
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: { code: 'QUOTE_SERVICE_ERROR', message: 'Failed to fetch kline' },
      };
    }
  });
  
  // ============================================
  // 热门股票
  // ============================================
  
  app.get('/hot', async () => {
    try {
      const response = await fetch(`${quoteServiceUrl}/hot`);
      const data = await response.json();
      
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: { code: 'QUOTE_SERVICE_ERROR', message: 'Failed to fetch hot stocks' },
      };
    }
  });
  
  // ============================================
  // 市场概况
  // ============================================
  
  app.get('/overview', async () => {
    try {
      const response = await fetch(`${quoteServiceUrl}/overview`);
      const data = await response.json();
      
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: { code: 'QUOTE_SERVICE_ERROR', message: 'Failed to fetch overview' },
      };
    }
  });
}
