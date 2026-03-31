import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// 常量
// ============================================

// A股费率
const CN_COMMISSION_RATE = new Decimal('0.00025');  // 佣金: 万2.5
const CN_COMMISSION_MIN = new Decimal('5.00');       // 最低佣金
const CN_STAMP_TAX_RATE = new Decimal('0.001');      // 印花税: 千1 (仅卖出)
const CN_TRANSFER_FEE_RATE = new Decimal('0.00002'); // 过户费: 十万2 (仅沪市)

// 港股费率
const HK_COMMISSION_RATE = new Decimal('0.00025');   // 佣金: 万2.5
const HK_COMMISSION_MIN = new Decimal('50.00');       // 最低佣金 50港币
const HK_STAMP_TAX_RATE = new Decimal('0.001');       // 印花税: 千1 (买卖双向)
const HK_TRADING_FEE_RATE = new Decimal('0.00005');   // 交易费: 十万5
const HK_SETTLEMENT_FEE_RATE = new Decimal('0.00002'); // 结算费: 十万2

// ============================================
// 市场类型
// ============================================

type Market = 'CN' | 'HK' | 'US';

function getMarket(stockCode: string): Market {
  if (stockCode.startsWith('HK')) {
    return 'HK';
  }
  // 纯字母代码视为美股 (NIO, AAPL, TSLA)
  if (/^[A-Z]{1,5}$/.test(stockCode)) {
    return 'US';
  }
  return 'CN';
}

function getExchange(stockCode: string): string {
  if (stockCode.startsWith('HK')) return 'HK';
  if (stockCode.startsWith('SH')) return 'SH';
  if (stockCode.startsWith('SZ')) return 'SZ';
  // 美股默认 NASDAQ
  if (/^[A-Z]{1,5}$/.test(stockCode)) return 'US';
  return 'SZ';
}

function getCurrency(market: Market): string {
  if (market === 'HK') return 'HKD';
  if (market === 'US') return 'USD';
  return 'CNY';
}

function getCurrencySymbol(market: Market): string {
  if (market === 'HK') return 'HK$';
  if (market === 'US') return '$';
  return '¥';
}

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
    const market = getMarket(stockCode);
    
    // 1. 检查交易时间
    if (!this.isTradingTime(market)) {
      let timeDesc: string;
      if (market === 'HK') {
        timeDesc = '港股交易时间: 9:30-12:00, 13:00-16:00 (HKT)';
      } else if (market === 'US') {
        timeDesc = '美股交易时间: 9:30-16:00 (ET) / 北京时间 21:30-04:00';
      } else {
        timeDesc = 'A股交易时间: 9:30-11:30, 13:00-15:00';
      }
      throw new TradingError('MARKET_CLOSED', `当前不在交易时间 (${timeDesc})`);
    }
    
    // 2. 验证股数
    if (market === 'CN') {
      if (shares <= 0 || shares % 100 !== 0) {
        throw new TradingError('INVALID_SHARES', 'A股股数必须是 100 的正整数倍');
      }
    } else {
      // 港股和美股可以买任意数量
      if (shares <= 0) {
        throw new TradingError('INVALID_SHARES', '股数必须大于0');
      }
    }
    
    // 3. 获取行情
    const quote = await this.getQuote(stockCode);
    if (!quote) {
      throw new TradingError('STOCK_NOT_FOUND', `股票 ${stockCode} 不存在`);
    }
    
    // 4. 检查涨跌停 (仅A股)
    if (market === 'CN') {
      this.checkPriceLimit(stockCode, quote.name, quote.price, quote.preClose, side);
    }
    
    // 5. 执行交易
    if (side === 'buy') {
      return this.executeBuy(portfolioId, agentId, stockCode, quote, shares, reason, market);
    } else {
      return this.executeSell(portfolioId, agentId, stockCode, quote, shares, reason, market);
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
    reason: string,
    market: Market
  ) {
    const price = new Decimal(quote.price);
    const amount = price.mul(shares);
    const fees = this.calculateFees(stockCode, amount, 'buy', market);
    const netAmount = amount.add(fees.total);
    const currency = getCurrency(market);
    const currencySymbol = getCurrencySymbol(market);
    
    // 获取组合
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });
    
    if (!portfolio) {
      throw new TradingError('PORTFOLIO_NOT_FOUND', '组合不存在');
    }
    
    // 验证现金 (简化: 假设港股也用同一现金池，实际应该换算汇率)
    if (portfolio.cash.lessThan(netAmount)) {
      throw new TradingError(
        'INSUFFICIENT_CASH',
        `现金不足: 需要 ${currencySymbol}${netAmount.toFixed(2)}, 可用 ${currencySymbol}${portfolio.cash.toFixed(2)}`
      );
    }
    
    // 验证单笔限制 (50%)
    const maxSingle = portfolio.totalValue.mul('0.5');
    if (amount.greaterThan(maxSingle)) {
      throw new TradingError(
        'SINGLE_TRADE_LIMIT',
        `单笔不能超过总资产50%: ${currencySymbol}${maxSingle.toFixed(2)}`
      );
    }
    
    // T+0 或 T+1 (港股和美股是 T+0，A股是 T+1)
    const isT0 = market === 'HK' || market === 'US';
    
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
            // T+0 市场立即可卖，T+1 市场不变
            availableShares: isT0 ? newShares : existingPosition.availableShares,
          },
        });
      } else {
        await tx.position.create({
          data: {
            portfolioId,
            stockCode,
            stockName: quote.name,
            market: getExchange(stockCode),
            board: this.getBoard(stockCode, quote.name),
            shares,
            availableShares: isT0 ? shares : 0, // T+0 立即可卖，T+1 需等下一交易日
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
    await this.createTradePost(result, quote.name, fees, market);
    
    const note = isT0 
      ? 'T+0: 该笔买入可立即卖出'
      : 'T+1: 该笔买入将于下一个交易日可卖出';
    
    return {
      ...result,
      fees,
      note,
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
    reason: string,
    market: Market
  ) {
    const currencySymbol = getCurrencySymbol(market);
    const isT0 = market === 'HK';
    
    // 获取持仓
    const position = await this.prisma.position.findUnique({
      where: {
        portfolioId_stockCode: { portfolioId, stockCode },
      },
    });
    
    if (!position) {
      throw new TradingError('POSITION_NOT_FOUND', `没有 ${stockCode} 的持仓`);
    }
    
    // T+1 检查 (港股 T+0 不需要检查)
    if (!isT0 && position.availableShares < shares) {
      throw new TradingError(
        'T1_RESTRICTION',
        `T+1 限制: 持有 ${position.shares} 股, 可卖 ${position.availableShares} 股, 要卖 ${shares} 股`
      );
    }
    
    // 港股也要检查总持仓
    if (position.shares < shares) {
      throw new TradingError(
        'INSUFFICIENT_SHARES',
        `持仓不足: 持有 ${position.shares} 股, 要卖 ${shares} 股`
      );
    }
    
    const price = new Decimal(quote.price);
    const amount = price.mul(shares);
    const fees = this.calculateFees(stockCode, amount, 'sell', market);
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
        const newAvailable = isT0 
          ? newShares 
          : Math.max(0, position.availableShares - shares);
        
        await tx.position.update({
          where: { id: position.id },
          data: {
            shares: newShares,
            availableShares: newAvailable,
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
    await this.createTradePost(result, quote.name, fees, market);
    
    return result;
  }
  
  /**
   * 检查交易时间
   */
  private isTradingTime(market: Market): boolean {
    // 测试模式跳过时间检查
    if (process.env.SKIP_MARKET_HOURS === 'true') {
      return true;
    }
    
    const now = new Date();
    const hours = now.getUTCHours() + 8; // 转北京/香港时间 (同时区)
    const minutes = now.getUTCMinutes();
    const time = hours * 100 + minutes;
    
    // 周末
    const day = now.getUTCDay();
    if (day === 0 || day === 6) {
      return false;
    }
    
    if (market === 'HK') {
      // 港股: 9:30-12:00, 13:00-16:00 (HKT = UTC+8)
      const isMorning = time >= 930 && time <= 1200;
      const isAfternoon = time >= 1300 && time <= 1600;
      return isMorning || isAfternoon;
    } else if (market === 'US') {
      // 美股: 9:30-16:00 ET (UTC-4/5)
      // 简化处理: 北京时间 21:30-04:00 (夏令时) 或 22:30-05:00 (冬令时)
      // 这里用宽松时间检查
      const isUSHours = (time >= 2130 || time <= 500);
      return isUSHours;
    } else {
      // A股: 9:30-11:30, 13:00-15:00 (UTC+8)
      const isMorning = time >= 930 && time <= 1130;
      const isAfternoon = time >= 1300 && time <= 1500;
      return isMorning || isAfternoon;
    }
  }
  
  /**
   * 计算手续费
   */
  private calculateFees(stockCode: string, amount: Decimal, side: 'buy' | 'sell', market: Market) {
    if (market === 'HK') {
      return this.calculateHKFees(amount, side);
    }
    if (market === 'US') {
      return this.calculateUSFees(amount, side);
    }
    return this.calculateCNFees(stockCode, amount, side);
  }
  
  /**
   * A股手续费
   */
  private calculateCNFees(stockCode: string, amount: Decimal, side: 'buy' | 'sell') {
    // 佣金
    let commission = amount.mul(CN_COMMISSION_RATE);
    commission = Decimal.max(commission, CN_COMMISSION_MIN);
    
    // 印花税 (仅卖出)
    const stampTax = side === 'sell' ? amount.mul(CN_STAMP_TAX_RATE) : new Decimal(0);
    
    // 过户费 (仅沪市)
    const transferFee = stockCode.startsWith('SH6')
      ? amount.mul(CN_TRANSFER_FEE_RATE)
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
   * 港股手续费
   */
  private calculateHKFees(amount: Decimal, side: 'buy' | 'sell') {
    // 佣金
    let commission = amount.mul(HK_COMMISSION_RATE);
    commission = Decimal.max(commission, HK_COMMISSION_MIN);
    
    // 印花税 (买卖双向)
    const stampTax = amount.mul(HK_STAMP_TAX_RATE);
    
    // 交易费
    const tradingFee = amount.mul(HK_TRADING_FEE_RATE);
    
    // 结算费
    const settlementFee = amount.mul(HK_SETTLEMENT_FEE_RATE);
    
    const total = commission.add(stampTax).add(tradingFee).add(settlementFee);
    
    return {
      commission: commission.toDecimalPlaces(2),
      stampTax: stampTax.toDecimalPlaces(2),
      transferFee: tradingFee.add(settlementFee).toDecimalPlaces(2), // 合并为 transferFee
      total: total.toDecimalPlaces(2),
    };
  }
  
  /**
   * 美股手续费
   */
  private calculateUSFees(amount: Decimal, side: 'buy' | 'sell') {
    // 美股佣金: 0.005 美元/股，最低 1 美元，这里简化为 0.1% 费率
    const US_COMMISSION_RATE = 0.001;
    const US_COMMISSION_MIN = 1;
    
    let commission = amount.mul(US_COMMISSION_RATE);
    commission = Decimal.max(commission, US_COMMISSION_MIN);
    
    // SEC 费用 (仅卖出): 约 $8 / $1,000,000
    const secFee = side === 'sell' ? amount.mul(0.000008) : new Decimal(0);
    
    // TAF 费用: $0.000119/股，这里简化为 0.01%
    const tafFee = amount.mul(0.0001);
    
    const total = commission.add(secFee).add(tafFee);
    
    return {
      commission: commission.toDecimalPlaces(2),
      stampTax: secFee.toDecimalPlaces(2),
      transferFee: tafFee.toDecimalPlaces(2),
      total: total.toDecimalPlaces(2),
    };
  }
  
  /**
   * 检查涨跌停 (仅A股)
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
    if (stockCode.startsWith('HK')) {
      return 'hk'; // 港股
    }
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
      const quoteServiceUrl = process.env.QUOTE_SERVICE_URL || 'http://localhost:3005';
      const response = await fetch(`${quoteServiceUrl}/v1/market/quotes?codes=${stockCode}`);
      
      if (!response.ok) {
        return null;
      }
      
      const json = await response.json();
      // 返回格式: { success: true, data: [{ code, name, price, ... }] }
      if (json.success && json.data && json.data.length > 0) {
        return json.data[0];
      }
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * 发布交易动态
   */
  private async createTradePost(trade: any, stockName: string, fees: any, market: Market) {
    const sideCN = trade.side === 'buy' ? '买入' : '卖出';
    const currencySymbol = getCurrencySymbol(market);
    const marketLabel = market === 'HK' ? '🇭🇰 ' : '';
    
    const pnlText = trade.realizedPnl
      ? `, 盈亏 ${trade.realizedPnl > 0 ? '+' : ''}${currencySymbol}${trade.realizedPnl.toFixed(2)}`
      : '';
    
    const content = `
## ${marketLabel}${sideCN} ${stockName}

- 股票: ${stockName} (${trade.stockCode})
- 数量: ${trade.shares} 股
- 价格: ${currencySymbol}${trade.price}
- 金额: ${currencySymbol}${trade.amount}${pnlText}

**理由**: ${trade.reason}
    `.trim();
    
    await this.prisma.post.create({
      data: {
        agentId: trade.agentId,
        type: 'trade',
        title: `${marketLabel}${sideCN} ${stockName} ${trade.shares}股`,
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
  market?: string;
  currency?: string;
  price: number;
  preClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  changePct: number;
}
