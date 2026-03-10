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
      const response = await fetch(`${quoteServiceUrl}/v1/market/quotes?codes=${query.codes}`);
      const data = await response.json();
      
      return data;
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
        `${quoteServiceUrl}/v1/market/kline/${code}?period=${period}&count=${count}`
      );
      const data = await response.json();
      
      return data;
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
      const response = await fetch(`${quoteServiceUrl}/v1/market/hot`);
      const data = await response.json();
      
      return data;
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
      const response = await fetch(`${quoteServiceUrl}/v1/market/overview`);
      const data = await response.json();
      
      return data;
    } catch (error) {
      return {
        success: false,
        error: { code: 'QUOTE_SERVICE_ERROR', message: 'Failed to fetch overview' },
      };
    }
  });
  
  // ============================================
  // 新闻资讯
  // ============================================
  
  app.get('/news', async (request: FastifyRequest) => {
    const query = request.query as { code?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit || '20'), 50);
    
    try {
      let url = `${quoteServiceUrl}/v1/market/news?limit=${limit}`;
      if (query.code) {
        url += `&code=${query.code}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      return data;
    } catch (error) {
      return {
        success: false,
        error: { code: 'QUOTE_SERVICE_ERROR', message: 'Failed to fetch news' },
      };
    }
  });
  
  app.get('/news/hot', async (request: FastifyRequest) => {
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || '10'), 50);
    
    try {
      const response = await fetch(`${quoteServiceUrl}/v1/market/news/hot?limit=${limit}`);
      const data = await response.json();
      
      return data;
    } catch (error) {
      return {
        success: false,
        error: { code: 'QUOTE_SERVICE_ERROR', message: 'Failed to fetch hot news' },
      };
    }
  });
  
  app.get('/news/stock/:code', async (request: FastifyRequest) => {
    const { code } = request.params as { code: string };
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || '10'), 50);
    
    try {
      const response = await fetch(`${quoteServiceUrl}/v1/market/news/stock/${code}?limit=${limit}`);
      const data = await response.json();
      
      return data;
    } catch (error) {
      return {
        success: false,
        error: { code: 'QUOTE_SERVICE_ERROR', message: 'Failed to fetch stock news' },
      };
    }
  });
  
  // ============================================
  // 技术指标
  // ============================================
  
  app.get('/indicators/:code', async (request: FastifyRequest) => {
    const { code } = request.params as { code: string };
    const query = request.query as { period?: string };
    const period = query.period || 'daily';
    
    try {
      const response = await fetch(`${quoteServiceUrl}/v1/market/indicators/${code}?period=${period}`);
      const data = await response.json();
      
      return data;
    } catch (error) {
      return {
        success: false,
        error: { code: 'QUOTE_SERVICE_ERROR', message: 'Failed to fetch indicators' },
      };
    }
  });
  
  // ============================================
  // 基本面/估值
  // ============================================
  
  app.get('/fundamental/:code', async (request: FastifyRequest) => {
    const { code } = request.params as { code: string };
    
    try {
      const response = await fetch(`${quoteServiceUrl}/v1/market/fundamental/${code}`);
      const data = await response.json();
      
      return data;
    } catch (error) {
      return {
        success: false,
        error: { code: 'QUOTE_SERVICE_ERROR', message: 'Failed to fetch fundamental' },
      };
    }
  });
}
