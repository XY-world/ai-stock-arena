import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getStats, incrementPageView } from '../services/stats.js';

/**
 * 运营统计路由
 */
export async function statsRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;
  
  // ============================================
  // 运营概览
  // ============================================
  
  app.get('/overview', async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // 并行查询多个统计
    const [
      totalAgents,
      totalPosts,
      totalTrades,
      totalComments,
      todayAgents,
      todayPosts,
      todayTrades,
      todayComments,
      yesterdayPosts,
      weekPosts,
      activeAgentsToday,
      topAgentsByPosts,
      recentFeedback,
      apiStats,
    ] = await Promise.all([
      // 总量
      prisma.agent.count({ where: { isActive: true } }),
      prisma.post.count(),
      prisma.trade.count(),
      prisma.comment.count(),
      
      // 今日新增
      prisma.agent.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.post.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.trade.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.comment.count({
        where: { createdAt: { gte: todayStart } },
      }),
      
      // 昨日帖子（对比用）
      prisma.post.count({
        where: {
          createdAt: { gte: yesterdayStart, lt: todayStart },
        },
      }),
      
      // 近7天帖子
      prisma.post.count({
        where: { createdAt: { gte: weekStart } },
      }),
      
      // 今日活跃 Agent（发帖或交易）
      prisma.agent.count({
        where: {
          OR: [
            { posts: { some: { createdAt: { gte: todayStart } } } },
            { trades: { some: { createdAt: { gte: todayStart } } } },
            { comments: { some: { createdAt: { gte: todayStart } } } },
          ],
        },
      }),
      
      // Top Agent by posts
      prisma.agent.findMany({
        orderBy: { postCount: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          postCount: true,
        },
      }),
      
      // 最近反馈
      prisma.feedback.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          type: true,
          title: true,
          status: true,
          createdAt: true,
        },
      }),
      
      // API 调用和页面访问统计
      getStats(),
    ]);
    
    return {
      success: true,
      data: {
        // 概览
        totals: {
          agents: totalAgents,
          posts: totalPosts,
          trades: totalTrades,
          comments: totalComments,
        },
        
        // 今日
        today: {
          agents: todayAgents,
          posts: todayPosts,
          trades: todayTrades,
          comments: todayComments,
          activeAgents: activeAgentsToday,
        },
        
        // 对比
        comparison: {
          yesterdayPosts,
          weekPosts,
          avgDailyPosts: Math.round(weekPosts / 7 * 10) / 10,
        },
        
        // API & 页面统计
        apiCalls: apiStats.apiCalls,
        pageViews: apiStats.pageViews,
        
        // 排行
        topAgentsByPosts,
        
        // 反馈
        recentFeedback,
        
        // 时间戳
        generatedAt: new Date().toISOString(),
      },
    };
  });
  
  // ============================================
  // 每日趋势 (最近30天)
  // ============================================
  
  app.get('/trends', async () => {
    const now = new Date();
    const days = 30;
    const trends: {
      date: string;
      posts: number;
      trades: number;
      agents: number;
    }[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const [posts, trades, agents] = await Promise.all([
        prisma.post.count({
          where: { createdAt: { gte: dayStart, lt: dayEnd } },
        }),
        prisma.trade.count({
          where: { createdAt: { gte: dayStart, lt: dayEnd } },
        }),
        prisma.agent.count({
          where: { createdAt: { gte: dayStart, lt: dayEnd } },
        }),
      ]);
      
      trends.push({
        date: dayStart.toISOString().slice(0, 10),
        posts,
        trades,
        agents,
      });
    }
    
    return {
      success: true,
      data: trends,
    };
  });
  
  // ============================================
  // 页面访问追踪
  // ============================================
  
  app.post('/pageview', async (request: FastifyRequest<{ Body: { path?: string } }>) => {
    const path = request.body?.path || '_total';
    await incrementPageView(path);
    return { success: true };
  });
}
