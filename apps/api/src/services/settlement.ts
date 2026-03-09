import type { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * 每日结算服务
 * 每个交易日 15:05 执行
 */
export class SettlementService {
  constructor(private prisma: PrismaClient) {}
  
  /**
   * 执行每日结算
   */
  async runDailySettlement() {
    console.log('📊 开始每日结算...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 获取所有组合
    const portfolios = await this.prisma.portfolio.findMany({
      include: {
        positions: true,
      },
    });
    
    for (const portfolio of portfolios) {
      try {
        await this.settlePortfolio(portfolio, today);
      } catch (error) {
        console.error(`结算组合 ${portfolio.id} 失败:`, error);
      }
    }
    
    // 更新排行榜
    await this.updateRankings();
    
    console.log('✅ 每日结算完成');
  }
  
  /**
   * 结算单个组合
   */
  private async settlePortfolio(portfolio: any, today: Date) {
    // 1. 更新持仓市值
    let totalMarketValue = new Decimal(0);
    
    for (const position of portfolio.positions) {
      // 获取最新价格 (从缓存或行情服务)
      const price = await this.getLatestPrice(position.stockCode);
      
      if (price) {
        const marketValue = price.mul(position.shares);
        const unrealizedPnl = marketValue.sub(position.costBasis);
        const unrealizedPnlPct = position.costBasis.greaterThan(0)
          ? unrealizedPnl.div(position.costBasis)
          : new Decimal(0);
        
        await this.prisma.position.update({
          where: { id: position.id },
          data: {
            currentPrice: price,
            marketValue,
            unrealizedPnl,
            unrealizedPnlPct,
            // T+1: 更新可卖数量 (所有持仓明日可卖)
            availableShares: position.shares,
          },
        });
        
        totalMarketValue = totalMarketValue.add(marketValue);
      }
    }
    
    // 2. 计算总资产
    const totalValue = portfolio.cash.add(totalMarketValue);
    const totalReturn = totalValue.sub(portfolio.initialCapital).div(portfolio.initialCapital);
    
    // 3. 获取昨日净值
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const yesterdayDaily = await this.prisma.portfolioDaily.findFirst({
      where: {
        portfolioId: portfolio.id,
        date: { lt: today },
      },
      orderBy: { date: 'desc' },
    });
    
    const yesterdayNetValue = yesterdayDaily?.netValue || new Decimal(1);
    const todayNetValue = totalValue.div(portfolio.initialCapital);
    const dailyReturn = todayNetValue.sub(yesterdayNetValue).div(yesterdayNetValue);
    
    // 4. 计算最大回撤
    const maxDrawdown = await this.calculateMaxDrawdown(portfolio.id);
    
    // 5. 计算夏普比率
    const sharpeRatio = await this.calculateSharpeRatio(portfolio.id);
    
    // 6. 更新组合
    await this.prisma.portfolio.update({
      where: { id: portfolio.id },
      data: {
        totalValue,
        marketValue: totalMarketValue,
        totalReturn,
        todayReturn: dailyReturn,
        maxDrawdown,
        sharpeRatio,
      },
    });
    
    // 7. 更新持仓权重
    for (const position of portfolio.positions) {
      const weight = position.marketValue && totalValue.greaterThan(0)
        ? new Decimal(position.marketValue).div(totalValue)
        : new Decimal(0);
      
      await this.prisma.position.update({
        where: { id: position.id },
        data: { weight },
      });
    }
    
    // 8. 记录每日净值
    await this.prisma.portfolioDaily.upsert({
      where: {
        portfolioId_date: {
          portfolioId: portfolio.id,
          date: today,
        },
      },
      create: {
        portfolioId: portfolio.id,
        date: today,
        totalValue,
        cash: portfolio.cash,
        marketValue: totalMarketValue,
        netValue: todayNetValue,
        dailyReturn,
        totalReturn,
      },
      update: {
        totalValue,
        cash: portfolio.cash,
        marketValue: totalMarketValue,
        netValue: todayNetValue,
        dailyReturn,
        totalReturn,
      },
    });
  }
  
  /**
   * 获取最新价格
   */
  private async getLatestPrice(stockCode: string): Promise<Decimal | null> {
    try {
      const quoteServiceUrl = process.env.QUOTE_SERVICE_URL || 'http://localhost:8001';
      const response = await fetch(`${quoteServiceUrl}/quotes/${stockCode}`);
      
      if (!response.ok) return null;
      
      const quote = await response.json() as { price: number };
      return new Decimal(quote.price);
    } catch {
      return null;
    }
  }
  
  /**
   * 计算最大回撤
   */
  private async calculateMaxDrawdown(portfolioId: string): Promise<Decimal> {
    const dailyData = await this.prisma.portfolioDaily.findMany({
      where: { portfolioId },
      orderBy: { date: 'asc' },
      select: { netValue: true },
    });
    
    if (dailyData.length < 2) {
      return new Decimal(0);
    }
    
    let maxNetValue = new Decimal(0);
    let maxDrawdown = new Decimal(0);
    
    for (const { netValue } of dailyData) {
      if (netValue.greaterThan(maxNetValue)) {
        maxNetValue = netValue;
      }
      
      const drawdown = maxNetValue.sub(netValue).div(maxNetValue);
      if (drawdown.greaterThan(maxDrawdown)) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }
  
  /**
   * 计算夏普比率
   * 假设无风险利率为 2% 年化
   */
  private async calculateSharpeRatio(portfolioId: string): Promise<Decimal | null> {
    const dailyData = await this.prisma.portfolioDaily.findMany({
      where: { portfolioId },
      orderBy: { date: 'asc' },
      select: { dailyReturn: true },
    });
    
    if (dailyData.length < 30) {
      return null; // 数据不足
    }
    
    const returns = dailyData.map(d => d.dailyReturn.toNumber());
    const riskFreeDaily = 0.02 / 252; // 年化 2% 转日收益
    
    // 平均日收益
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    // 标准差
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) {
      return null;
    }
    
    // 夏普比率 (年化)
    const sharpe = ((avgReturn - riskFreeDaily) / stdDev) * Math.sqrt(252);
    
    return new Decimal(sharpe.toFixed(4));
  }
  
  /**
   * 更新排行榜
   */
  private async updateRankings() {
    // 收益率排名
    const byReturn = await this.prisma.portfolio.findMany({
      orderBy: { totalReturn: 'desc' },
      select: { id: true },
    });
    
    for (let i = 0; i < byReturn.length; i++) {
      await this.prisma.portfolio.update({
        where: { id: byReturn[i].id },
        data: { rankReturn: i + 1 },
      });
    }
    
    // 夏普比率排名
    const bySharpe = await this.prisma.portfolio.findMany({
      where: { sharpeRatio: { not: null } },
      orderBy: { sharpeRatio: 'desc' },
      select: { id: true },
    });
    
    for (let i = 0; i < bySharpe.length; i++) {
      await this.prisma.portfolio.update({
        where: { id: bySharpe[i].id },
        data: { rankSharpe: i + 1 },
      });
    }
    
    console.log(`🏆 排行榜已更新: ${byReturn.length} 个组合`);
  }
  
  /**
   * T+1 早盘更新
   * 每个交易日 09:25 执行
   */
  async runT1Update() {
    console.log('📊 开始 T+1 更新...');
    
    // 将所有持仓的 availableShares 更新为 shares
    const result = await this.prisma.$executeRaw`
      UPDATE "Position" SET "availableShares" = "shares"
    `;
    
    console.log(`✅ T+1 更新完成`);
  }
}
