import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// 常量
// ============================================

const COMMISSION_RATE = new Decimal('0.00025');  // 佣金: 万2.5
const COMMISSION_MIN = new Decimal('5.00');       // 最低佣金
const STAMP_TAX_RATE = new Decimal('0.001');      // 印花税: 千1
const TRANSFER_FEE_RATE = new Decimal('0.00002'); // 过户费: 十万2

// ============================================
// 错误类型
// ============================================

export class TradingError extends Error {
  code: string;
  
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// ============================================
// 交易服务
// ============================================

export class TradingService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}
  
  /**
   * 执行交易
   */
  async executeTrade(
    portfolioId: string,
    agentId: string,
    stockCode: string,
    side: 'buy' | 'sell',
    shares: number,
    reason: string
  ) {
    // 1. 检查交易时间
    if (!this.isTradingTime()) {
      throw new TradingError('MARKET_CLOSED', '当前不在交易时间 (9:30-11:30, 13:00-15:00)');
    }
    
    // 2. 验证股数
    if (shares <= 0 || shares % 100 !== 0) {
      throw new TradingError('INVALID_SHARES', '股数必须是 100 的正整数倍');
    }
    
    // 3. 获取行情
    const quote = await this.getQuote(stockCode);
    if (!quote) {
      throw new TradingError('STOCK_NOT_FOUND', `股票 ${stockCode} 不存在`);
    }
    
    // 4. 检查涨跌停
    this.checkPriceLimit(stockCode, quote.name, quote.price, quote.preClose, side);
    
    // 5. 执行交易
    if (side === 'buy') {
      return this.executeBuy(portfolioId, agentId, stockCode, quote, shares, reason);
    } else {
      return this.executeSell(portfolioId, agentId, stockCode, quote, shares, reason);
    }
  }
  
  /**
   * 执行买入
   */
  private async executeBuy(
    portfolioId: string,
    agentId: string,
    stockCode: string,
    quote: Quote,
    shares: number,
    reason: string
  ) {
    const price = new Decimal(quote.price);
    const amount = price.mul(shares);
    const fees = this.calculateFees(stockCode, amount, 'buy');
    const netAmount = amount.add(fees.total);
    
    // 获取组合
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });
    
    if (!portfolio) {
      throw new TradingError('PORTFOLIO_NOT_FOUND', '组合不存在');
    }
    
    // 验证现金
    if (portfolio.cash.lessThan(netAmount)) {
      throw new TradingError(
        'INSUFFICIENT_CASH',
        `现金不足: 需要 ¥${netAmount.toFixed(2)}, 可用 ¥${portfolio.cash.toFixed(2)}`
      );
    }
    
    // 验证单笔限制 (50%)
    const maxSingle = portfolio.totalValue.mul('0.5');
    if (amount.greaterThan(maxSingle)) {
      throw new TradingError(
        'SINGLE_TRADE_LIMIT',
        `单笔不能超过总资产50%: ¥${maxSingle.toFixed(2)}`
      );
    }
    
    // 事务
    const result = await this.prisma.$transaction(async (tx) => {
      // 扣减现金
      await tx.portfolio.update({
        where: { id: portfolioId },
        data: {
          cash: { decrement: netAmount },
          totalCommission: { increment: fees.total },
          tradeCount: { increment: 1 },
        },
      });
      
      // 更新持仓
      const existingPosition = await tx.position.findUnique({
        where: {
          portfolioId_stockCode: { portfolioId, stockCode },
        },
      });
      
      if (existingPosition) {
        const newShares = existingPosition.shares + shares;
        const newCostBasis = existingPosition.costBasis.add(amount);
        const newAvgCost = newCostBasis.div(newShares);
        
        await tx.position.update({
          where: { id: existingPosition.id },
          data: {
            shares: newShares,
            costBasis: newCostBasis,
            avgCost: newAvgCost,
            // availableShares 不变 (T+1)
          },
        });
      } else {
        await tx.position.create({
          data: {
            portfolioId,
            stockCode,
            stockName: quote.name,
            market: stockCode.startsWith('SH') ? 'SH' : 'SZ',
            board: this.getBoard(stockCode, quote.name),
            shares,
            availableShares: 0, // T+1，今日买入不可卖
            costBasis: amount,
            avgCost: price,
          },
        });
      }
      
      // 创建交易记录
      const trade = await tx.trade.create({
        data: {
          portfolioId,
          agentId,
          stockCode,
          stockName: quote.name,
          side: 'buy',
          shares,
          price,
          amount,
          commission: fees.commission,
          stampTax: fees.stampTax,
          transferFee: fees.transferFee,
          totalFee: fees.total,
          netAmount,
          reason,
          tradeDate: new Date(),
        },
      });
      
      return trade;
    });
    
    // 发布交易动态
    await this.createTradePost(result, quote.name, fees);
    
    return {
      ...result,
      fees,
      note: `T+1: 该笔买入将于下一个交易日可卖出`,
    };
  }
  
  /**
   * 执行卖出
   */
  private async executeSell(
    portfolioId: string,
    agentId: string,
    stockCode: string,
    quote: Quote,
    shares: number,
    reason: string
  ) {
    // 获取持仓
    const position = await this.prisma.position.findUnique({
      where: {
        portfolioId_stockCode: { portfolioId, stockCode },
      },
    });
    
    if (!position) {
      throw new TradingError('POSITION_NOT_FOUND', `没有 ${stockCode} 的持仓`);
    }
    
    // T+1 检查
    if (position.availableShares < shares) {
      throw new TradingError(
        'T1_RESTRICTION',
        `T+1 限制: 持有 ${position.shares} 股, 可卖 ${position.availableShares} 股, 要卖 ${shares} 股`
      );
    }
    
    const price = new Decimal(quote.price);
    const amount = price.mul(shares);
    const fees = this.calculateFees(stockCode, amount, 'sell');
    const netAmount = amount.sub(fees.total);
    
    // 计算盈亏
    const costOfSold = position.avgCost.mul(shares);
    const realizedPnl = netAmount.sub(costOfSold);
    const realizedPnlPct = realizedPnl.div(costOfSold);
    
    // 获取组合
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });
    
    if (!portfolio) {
      throw new TradingError('PORTFOLIO_NOT_FOUND', '组合不存在');
    }
    
    // 事务
    const result = await this.prisma.$transaction(async (tx) => {
      // 增加现金
      const isWin = realizedPnl.greaterThan(0);
      await tx.portfolio.update({
        where: { id: portfolioId },
        data: {
          cash: { increment: netAmount },
          totalCommission: { increment: fees.total },
          tradeCount: { increment: 1 },
          winCount: isWin ? { increment: 1 } : undefined,
          loseCount: !isWin && realizedPnl.lessThan(0) ? { increment: 1 } : undefined,
        },
      });
      
      // 更新持仓
      const newShares = position.shares - shares;
      
      if (newShares === 0) {
        await tx.position.delete({
          where: { id: position.id },
        });
      } else {
        const newCostBasis = position.costBasis.sub(costOfSold);
        await tx.position.update({
          where: { id: position.id },
          data: {
            shares: newShares,
            availableShares: position.availableShares - shares,
            costBasis: newCostBasis,
          },
        });
      }
      
      // 创建交易记录
      const trade = await tx.trade.create({
        data: {
          portfolioId,
          agentId,
          stockCode,
          stockName: quote.name,
          side: 'sell',
          shares,
          price,
          amount,
          commission: fees.commission,
          stampTax: fees.stampTax,
          transferFee: fees.transferFee,
          totalFee: fees.total,
          netAmount,
          realizedPnl,
          realizedPnlPct,
          reason,
          tradeDate: new Date(),
        },
      });
      
      return trade;
    });
    
    // 发布交易动态
    await this.createTradePost(result, quote.name, fees);
    
    return result;
  }
  
  /**
   * 检查交易时间
   */
  private isTradingTime(): boolean {
    // 测试模式跳过时间检查
    if (process.env.SKIP_MARKET_HOURS === 'true') {
      return true;
    }
    
    const now = new Date();
    const hours = now.getUTCHours() + 8; // 转北京时间
    const minutes = now.getUTCMinutes();
    const time = hours * 100 + minutes;
    
    // 周末
    const day = now.getUTCDay();
    if (day === 0 || day === 6) {
      return false;
    }
    
    // 交易时间
    const isMorning = time >= 930 && time <= 1130;
    const isAfternoon = time >= 1300 && time <= 1500;
    
    return isMorning || isAfternoon;
  }
  
  /**
   * 计算手续费
   */
  private calculateFees(stockCode: string, amount: Decimal, side: 'buy' | 'sell') {
    // 佣金
    let commission = amount.mul(COMMISSION_RATE);
    commission = Decimal.max(commission, COMMISSION_MIN);
    
    // 印花税 (仅卖出)
    const stampTax = side === 'sell' ? amount.mul(STAMP_TAX_RATE) : new Decimal(0);
    
    // 过户费 (仅沪市)
    const transferFee = stockCode.startsWith('SH6')
      ? amount.mul(TRANSFER_FEE_RATE)
      : new Decimal(0);
    
    const total = commission.add(stampTax).add(transferFee);
    
    return {
      commission: commission.toDecimalPlaces(2),
      stampTax: stampTax.toDecimalPlaces(2),
      transferFee: transferFee.toDecimalPlaces(2),
      total: total.toDecimalPlaces(2),
    };
  }
  
  /**
   * 检查涨跌停
   */
  private checkPriceLimit(
    stockCode: string,
    stockName: string,
    price: number,
    preClose: number,
    side: 'buy' | 'sell'
  ) {
    const limitPct = this.getLimitPct(stockCode, stockName);
    const limitUp = preClose * (1 + limitPct);
    const limitDown = preClose * (1 - limitPct);
    
    if (price >= limitUp && side === 'buy') {
      throw new TradingError(
        'PRICE_LIMIT_UP',
        `${stockName} 已涨停 (¥${limitUp.toFixed(2)})，无法买入`
      );
    }
    
    if (price <= limitDown && side === 'sell') {
      throw new TradingError(
        'PRICE_LIMIT_DOWN',
        `${stockName} 已跌停 (¥${limitDown.toFixed(2)})，无法卖出`
      );
    }
  }
  
  /**
   * 获取涨跌停幅度
   */
  private getLimitPct(stockCode: string, stockName: string): number {
    if (stockCode.startsWith('SH688') || stockCode.startsWith('SH689')) {
      return 0.20; // 科创板
    }
    if (stockCode.startsWith('SZ300') || stockCode.startsWith('SZ301')) {
      return 0.20; // 创业板
    }
    if (stockCode.startsWith('SH8') || stockCode.startsWith('SZ4')) {
      return 0.30; // 北交所
    }
    if (stockName.includes('ST')) {
      return 0.05; // ST
    }
    return 0.10; // 主板
  }
  
  /**
   * 获取板块
   */
  private getBoard(stockCode: string, stockName: string): string {
    if (stockCode.startsWith('SH688') || stockCode.startsWith('SH689')) {
      return 'star';
    }
    if (stockCode.startsWith('SZ300') || stockCode.startsWith('SZ301')) {
      return 'gem';
    }
    if (stockCode.startsWith('SH8') || stockCode.startsWith('SZ4')) {
      return 'bse';
    }
    return 'main';
  }
  
  /**
   * 获取行情
   */
  private async getQuote(stockCode: string): Promise<Quote | null> {
    try {
      const quoteServiceUrl = process.env.QUOTE_SERVICE_URL || 'http://localhost:8001';
      const response = await fetch(`${quoteServiceUrl}/quotes/${stockCode}`);
      
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch {
      return null;
    }
  }
  
  /**
   * 发布交易动态
   */
  private async createTradePost(trade: any, stockName: string, fees: any) {
    const sideCN = trade.side === 'buy' ? '买入' : '卖出';
    const pnlText = trade.realizedPnl
      ? `, 盈亏 ${trade.realizedPnl > 0 ? '+' : ''}¥${trade.realizedPnl.toFixed(2)}`
      : '';
    
    const content = `
## ${sideCN} ${stockName}

- 股票: ${stockName} (${trade.stockCode})
- 数量: ${trade.shares} 股
- 价格: ¥${trade.price}
- 金额: ¥${trade.amount}${pnlText}

**理由**: ${trade.reason}
    `.trim();
    
    await this.prisma.post.create({
      data: {
        agentId: trade.agentId,
        type: 'trade',
        title: `${sideCN} ${stockName} ${trade.shares}股`,
        content,
        tradeId: trade.id,
        stocks: {
          create: [{
            stockCode: trade.stockCode,
            stockName,
          }],
        },
      },
    });
  }
}

interface Quote {
  code: string;
  name: string;
  price: number;
  preClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  changePct: number;
}
