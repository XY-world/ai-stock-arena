/**
 * 子账户服务 - 富途风格多市场账户
 */

import type { PrismaClient, SubAccount, SubPosition, SubTrade } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { 
  MARKETS, 
  Market, 
  Currency,
  getExchangeRate, 
  convertAmount,
  calculateTotalAssetsCNY,
} from './exchange';

// 初始资金 (CNY)
const INITIAL_CAPITAL = 1000000;

// 交易规则配置
const TRADING_RULES: Record<Market, {
  settlement: 'T+0' | 'T+1';
  priceLimit: boolean;
  priceLimitPct?: number;
  commissionRate: number;
  commissionMin: number;
  stampTaxRate: number;
  stampTaxSide: 'sell' | 'both';
  tradingHours: string;
}> = {
  CN: {
    settlement: 'T+1',
    priceLimit: true,
    priceLimitPct: 0.1, // 10%
    commissionRate: 0.00025, // 万2.5
    commissionMin: 5,
    stampTaxRate: 0.001, // 千1
    stampTaxSide: 'sell',
    tradingHours: '9:30-11:30, 13:00-15:00',
  },
  HK: {
    settlement: 'T+0',
    priceLimit: false,
    commissionRate: 0.00025, // 万2.5
    commissionMin: 5,
    stampTaxRate: 0.001, // 千1
    stampTaxSide: 'both',
    tradingHours: '9:30-12:00, 13:00-16:00',
  },
  US: {
    settlement: 'T+0',
    priceLimit: false,
    commissionRate: 0.00025, // 万2.5
    commissionMin: 1,
    stampTaxRate: 0, // 无印花税
    stampTaxSide: 'sell',
    tradingHours: '21:30-04:00 (北京时间, 夏令时)',
  },
};

export class SubAccountService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 初始化 Agent 的子账户 (仅 A股账户，资金 100万)
   */
  async initializeSubAccounts(agentId: string): Promise<SubAccount[]> {
    // 创建 A股 账户，初始资金 100万
    const cnAccount = await this.prisma.subAccount.create({
      data: {
        agentId,
        market: 'CN',
        currency: 'CNY',
        balance: new Decimal(INITIAL_CAPITAL),
      },
    });

    return [cnAccount];
  }

  /**
   * 获取 Agent 的所有子账户
   */
  async getSubAccounts(agentId: string) {
    const accounts = await this.prisma.subAccount.findMany({
      where: { agentId },
      include: {
        positions: true,
      },
    });

    // 计算总资产
    const totalAssetsCNY = await calculateTotalAssetsCNY(accounts, this.prisma);

    // 获取汇率
    const rates = {
      CNY_HKD: await getExchangeRate('CNY', 'HKD', this.prisma),
      CNY_USD: await getExchangeRate('CNY', 'USD', this.prisma),
    };

    return {
      accounts: accounts.map(acc => ({
        ...acc,
        marketInfo: MARKETS[acc.market as Market],
        rules: TRADING_RULES[acc.market as Market],
      })),
      totalAssetsCNY,
      rates,
    };
  }

  /**
   * 开通子账户
   */
  async openSubAccount(agentId: string, market: Market): Promise<SubAccount> {
    // 检查是否已存在
    const existing = await this.prisma.subAccount.findUnique({
      where: { agentId_market: { agentId, market } },
    });

    if (existing) {
      throw new Error(`${MARKETS[market].name}账户已开通`);
    }

    return this.prisma.subAccount.create({
      data: {
        agentId,
        market,
        currency: MARKETS[market].currency,
        balance: 0,
      },
    });
  }

  /**
   * 换汇转账
   */
  async transfer(
    agentId: string,
    fromMarket: Market,
    toMarket: Market,
    amount: number
  ) {
    const fromCurrency = MARKETS[fromMarket].currency;
    const toCurrency = MARKETS[toMarket].currency;

    // 获取源账户
    const fromAccount = await this.prisma.subAccount.findUnique({
      where: { agentId_market: { agentId, market: fromMarket } },
    });

    if (!fromAccount) {
      throw new Error(`${MARKETS[fromMarket].name}账户未开通`);
    }

    if (fromAccount.balance.toNumber() < amount) {
      throw new Error(`${MARKETS[fromMarket].name}账户余额不足`);
    }

    // 获取或创建目标账户
    let toAccount = await this.prisma.subAccount.findUnique({
      where: { agentId_market: { agentId, market: toMarket } },
    });

    if (!toAccount) {
      toAccount = await this.openSubAccount(agentId, toMarket);
    }

    // 获取汇率
    const rate = await getExchangeRate(fromCurrency, toCurrency, this.prisma);
    const toAmount = amount * rate;

    // 执行转账 (事务)
    const result = await this.prisma.$transaction(async (tx) => {
      // 扣减源账户
      await tx.subAccount.update({
        where: { id: fromAccount.id },
        data: { balance: { decrement: amount } },
      });

      // 增加目标账户
      await tx.subAccount.update({
        where: { id: toAccount!.id },
        data: { balance: { increment: toAmount } },
      });

      // 记录转账
      const transfer = await tx.transfer.create({
        data: {
          agentId,
          fromMarket,
          toMarket,
          fromAmount: new Decimal(amount),
          toAmount: new Decimal(toAmount),
          rate: new Decimal(rate),
        },
      });

      return transfer;
    });

    return {
      transfer: result,
      fromAmount: amount,
      toAmount,
      rate,
      fromCurrency,
      toCurrency,
    };
  }

  /**
   * 获取交易规则
   */
  getTradingRules(market: Market) {
    return TRADING_RULES[market];
  }

  /**
   * 计算手续费
   */
  calculateFees(
    market: Market,
    side: 'buy' | 'sell',
    amount: number
  ) {
    const rules = TRADING_RULES[market];
    
    // 佣金
    let commission = amount * rules.commissionRate;
    if (commission < rules.commissionMin) {
      commission = rules.commissionMin;
    }

    // 印花税
    let stampTax = 0;
    if (rules.stampTaxRate > 0) {
      if (rules.stampTaxSide === 'both' || rules.stampTaxSide === side) {
        stampTax = amount * rules.stampTaxRate;
      }
    }

    const totalFee = commission + stampTax;

    return {
      commission,
      stampTax,
      totalFee,
    };
  }
}

export function createSubAccountService(prisma: PrismaClient) {
  return new SubAccountService(prisma);
}
