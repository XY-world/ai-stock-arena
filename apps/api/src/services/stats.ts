import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 获取今天的日期（UTC 0点）
function getToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// 增加 API 调用计数
export async function incrementApiCall(path?: string): Promise<void> {
  const today = getToday();
  
  try {
    await prisma.apiStats.upsert({
      where: {
        date_type_path: {
          date: today,
          type: 'api',
          path: path || '_total',
        },
      },
      update: {
        count: { increment: 1 },
      },
      create: {
        date: today,
        type: 'api',
        path: path || '_total',
        count: 1,
      },
    });
  } catch (err) {
    // 静默失败，不影响主流程
    console.error('Failed to increment API call:', err);
  }
}

// 增加页面访问计数
export async function incrementPageView(path?: string): Promise<void> {
  const today = getToday();
  
  try {
    await prisma.apiStats.upsert({
      where: {
        date_type_path: {
          date: today,
          type: 'page',
          path: path || '_total',
        },
      },
      update: {
        count: { increment: 1 },
      },
      create: {
        date: today,
        type: 'page',
        path: path || '_total',
        count: 1,
      },
    });
  } catch (err) {
    console.error('Failed to increment page view:', err);
  }
}

// 获取统计数据
export async function getStats(): Promise<{
  apiCalls: { today: number; total: number };
  pageViews: { today: number; total: number };
}> {
  const today = getToday();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    // 今日 API 调用
    const todayApi = await prisma.apiStats.aggregate({
      where: {
        date: today,
        type: 'api',
      },
      _sum: { count: true },
    });

    // 近30天 API 调用
    const totalApi = await prisma.apiStats.aggregate({
      where: {
        date: { gte: thirtyDaysAgo },
        type: 'api',
      },
      _sum: { count: true },
    });

    // 今日页面访问
    const todayPage = await prisma.apiStats.aggregate({
      where: {
        date: today,
        type: 'page',
      },
      _sum: { count: true },
    });

    // 近30天页面访问
    const totalPage = await prisma.apiStats.aggregate({
      where: {
        date: { gte: thirtyDaysAgo },
        type: 'page',
      },
      _sum: { count: true },
    });

    return {
      apiCalls: {
        today: todayApi._sum.count || 0,
        total: totalApi._sum.count || 0,
      },
      pageViews: {
        today: todayPage._sum.count || 0,
        total: totalPage._sum.count || 0,
      },
    };
  } catch (err) {
    console.error('Failed to get stats:', err);
    return {
      apiCalls: { today: 0, total: 0 },
      pageViews: { today: 0, total: 0 },
    };
  }
}
