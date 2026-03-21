/**
 * 汇率服务 - 实时汇率获取
 */

import type { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// 货币配置
export const CURRENCIES = {
  CNY: { symbol: '¥', name: '人民币' },
  HKD: { symbol: 'HK$', name: '港币' },
  USD: { symbol: '$', name: '美元' },
} as const;

export type Currency = keyof typeof CURRENCIES;

// 市场配置
export const MARKETS = {
  CN: { currency: 'CNY' as Currency, name: 'A股', flag: '🇨🇳' },
  HK: { currency: 'HKD' as Currency, name: '港股', flag: '🇭🇰' },
  US: { currency: 'USD' as Currency, name: '美股', flag: '🇺🇸' },
} as const;

export type Market = keyof typeof MARKETS;

// 缓存
let ratesCache: Map<string, { rate: number; updatedAt: Date }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

/**
 * 从新浪获取实时汇率
 */
async function fetchSinaRate(from: Currency, to: Currency): Promise<number | null> {
  // 新浪外汇接口
  // CNY -> HKD: http://hq.sinajs.cn/list=fx_scnyhkd
  // USD -> CNY: http://hq.sinajs.cn/list=fx_susdcny
  
  try {
    let code: string;
    let invert = false;
    
    if (from === 'CNY' && to === 'HKD') {
      code = 'fx_scnyhkd';
    } else if (from === 'HKD' && to === 'CNY') {
      code = 'fx_scnyhkd';
      invert = true;
    } else if (from === 'CNY' && to === 'USD') {
      code = 'fx_susdcny';
      invert = true;
    } else if (from === 'USD' && to === 'CNY') {
      code = 'fx_susdcny';
    } else if (from === 'USD' && to === 'HKD') {
      code = 'fx_susdhkd';
    } else if (from === 'HKD' && to === 'USD') {
      code = 'fx_susdhkd';
      invert = true;
    } else {
      return null;
    }
    
    const resp = await fetch(`http://hq.sinajs.cn/list=${code}`, {
      headers: { 'Referer': 'https://finance.sina.com.cn' },
    });
    
    const text = await resp.text();
    // 格式: var hq_str_fx_scnyhkd="04:59:59,1.137110,...";
    // 第二个字段是当前价
    const match = text.match(/="([^"]+)"/);
    if (!match) return null;
    
    const parts = match[1].split(',');
    // 当前价在第二个位置 (index 1)
    const rate = parseFloat(parts[1]);
    if (isNaN(rate)) return null;
    
    return invert ? 1 / rate : rate;
  } catch (error) {
    console.error(`Failed to fetch rate ${from}->${to}:`, error);
    return null;
  }
}

/**
 * 获取汇率 (带缓存)
 */
export async function getExchangeRate(
  from: Currency,
  to: Currency,
  prisma?: PrismaClient
): Promise<number> {
  if (from === to) return 1;
  
  const cacheKey = `${from}_${to}`;
  const cached = ratesCache.get(cacheKey);
  
  // 检查缓存
  if (cached && Date.now() - cached.updatedAt.getTime() < CACHE_TTL) {
    return cached.rate;
  }
  
  // 尝试获取实时汇率
  let rate = await fetchSinaRate(from, to);
  
  // 如果获取失败，使用默认值
  if (!rate) {
    const defaults: Record<string, number> = {
      'CNY_HKD': 1.09,
      'HKD_CNY': 0.92,
      'CNY_USD': 0.14,
      'USD_CNY': 7.25,
      'USD_HKD': 7.80,
      'HKD_USD': 0.128,
    };
    rate = defaults[cacheKey] || 1;
  }
  
  // 更新缓存
  ratesCache.set(cacheKey, { rate, updatedAt: new Date() });
  
  // 更新数据库 (如果有 prisma)
  if (prisma) {
    try {
      await prisma.exchangeRate.upsert({
        where: { fromCcy_toCcy: { fromCcy: from, toCcy: to } },
        update: { rate: new Decimal(rate) },
        create: { fromCcy: from, toCcy: to, rate: new Decimal(rate), source: 'sina' },
      });
    } catch (e) {
      // 忽略数据库错误
    }
  }
  
  return rate;
}

/**
 * 转换金额
 */
export async function convertAmount(
  amount: number | Decimal,
  from: Currency,
  to: Currency,
  prisma?: PrismaClient
): Promise<number> {
  const value = typeof amount === 'number' ? amount : amount.toNumber();
  const rate = await getExchangeRate(from, to, prisma);
  return value * rate;
}

/**
 * 批量获取汇率
 */
export async function getAllRates(prisma?: PrismaClient): Promise<Record<string, number>> {
  const pairs: [Currency, Currency][] = [
    ['CNY', 'HKD'],
    ['CNY', 'USD'],
    ['HKD', 'CNY'],
    ['HKD', 'USD'],
    ['USD', 'CNY'],
    ['USD', 'HKD'],
  ];
  
  const rates: Record<string, number> = {};
  
  await Promise.all(
    pairs.map(async ([from, to]) => {
      rates[`${from}_${to}`] = await getExchangeRate(from, to, prisma);
    })
  );
  
  return rates;
}

/**
 * 计算总资产 (CNY)
 */
export async function calculateTotalAssetsCNY(
  subAccounts: Array<{
    market: string;
    balance: Decimal;
    positions: Array<{ marketValue: Decimal | null }>;
  }>,
  prisma?: PrismaClient
): Promise<number> {
  let total = 0;
  
  for (const account of subAccounts) {
    const market = account.market as Market;
    const currency = MARKETS[market]?.currency || 'CNY';
    
    // 可用资金
    const balance = account.balance.toNumber();
    
    // 持仓市值
    const marketValue = account.positions.reduce(
      (sum, p) => sum + (p.marketValue?.toNumber() || 0),
      0
    );
    
    const accountTotal = balance + marketValue;
    
    // 转换为 CNY
    if (currency !== 'CNY') {
      total += await convertAmount(accountTotal, currency, 'CNY', prisma);
    } else {
      total += accountTotal;
    }
  }
  
  return total;
}
