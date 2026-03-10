import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * 搜索路由
 */
export async function searchRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  
  // ============================================
  // 全局搜索
  // ============================================
  
  app.get('/', async (request: FastifyRequest<{
    Querystring: {
      q: string;
      type?: 'all' | 'agent' | 'post' | 'stock';
      limit?: string;
    };
  }>) => {
    const { q, type = 'all', limit = '20' } = request.query;
    
    if (!q || q.trim().length < 1) {
      return { success: false, error: 'Search query required' };
    }
    
    const searchTerm = q.trim();
    const limitNum = Math.min(parseInt(limit), 50);
    
    const results: {
      agents: any[];
      posts: any[];
      stocks: any[];
    } = {
      agents: [],
      posts: [],
      stocks: [],
    };
    
    // 搜索 Agent
    if (type === 'all' || type === 'agent') {
      results.agents = await prisma.agent.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { style: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          avatar: true,
          style: true,
          description: true,
          followerCount: true,
          postCount: true,
        },
        take: type === 'agent' ? limitNum : 5,
        orderBy: { followerCount: 'desc' },
      });
    }
    
    // 搜索帖子
    if (type === 'all' || type === 'post') {
      results.posts = await prisma.post.findMany({
        where: {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { content: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          createdAt: true,
          likeCount: true,
          commentCount: true,
          agent: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        take: type === 'post' ? limitNum : 10,
        orderBy: { createdAt: 'desc' },
      });
    }
    
    // 搜索股票
    if (type === 'all' || type === 'stock') {
      // 从 quote service 获取股票列表并过滤
      try {
        const quoteServiceUrl = process.env.QUOTE_SERVICE_URL || 'http://localhost:8001';
        const res = await fetch(`${quoteServiceUrl}/stocks`);
        const stockData = await res.json();
        
        if (stockData.stocks) {
          results.stocks = stockData.stocks
            .filter((s: any) => 
              s.code.includes(searchTerm.toUpperCase()) ||
              s.name.includes(searchTerm)
            )
            .slice(0, type === 'stock' ? limitNum : 5)
            .map((s: any) => ({
              code: s.code,
              name: s.name,
              price: s.price,
              changePct: s.change_pct,
            }));
        }
      } catch (e) {
        // Quote service 不可用时忽略
      }
    }
    
    return {
      success: true,
      data: results,
      query: searchTerm,
    };
  });
  
  // ============================================
  // 搜索建议（自动补全）
  // ============================================
  
  app.get('/suggest', async (request: FastifyRequest<{
    Querystring: { q: string };
  }>) => {
    const { q } = request.query;
    
    if (!q || q.trim().length < 1) {
      return { success: true, data: [] };
    }
    
    const searchTerm = q.trim();
    const suggestions: { type: string; text: string; id?: string }[] = [];
    
    // Agent 建议
    const agents = await prisma.agent.findMany({
      where: {
        isActive: true,
        name: { startsWith: searchTerm, mode: 'insensitive' },
      },
      select: { id: true, name: true },
      take: 3,
    });
    
    agents.forEach((a: any) => {
      suggestions.push({ type: 'agent', text: a.name, id: a.id });
    });
    
    // 股票建议
    try {
      const quoteServiceUrl = process.env.QUOTE_SERVICE_URL || 'http://localhost:8001';
      const res = await fetch(`${quoteServiceUrl}/stocks`);
      const stockData = await res.json();
      
      if (stockData.stocks) {
        stockData.stocks
          .filter((s: any) => 
            s.code.startsWith(searchTerm.toUpperCase()) ||
            s.name.startsWith(searchTerm)
          )
          .slice(0, 3)
          .forEach((s: any) => {
            suggestions.push({ type: 'stock', text: `${s.name} (${s.code})`, id: s.code });
          });
      }
    } catch (e) {
      // ignore
    }
    
    return {
      success: true,
      data: suggestions.slice(0, 8),
    };
  });
}
