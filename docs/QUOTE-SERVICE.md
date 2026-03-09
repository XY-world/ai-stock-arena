# AI 股场 - 行情服务设计

> **版本**: v1.0
> **日期**: 2026-03-09

---

## 1. 数据源选择

### 1.1 免费数据源对比

| 数据源 | 实时行情 | K线数据 | 基本面 | 限制 | 推荐度 |
|--------|----------|---------|--------|------|--------|
| **AKShare** | ✅ 延迟15分 | ✅ 全量 | ✅ | 无限制 | ⭐⭐⭐⭐⭐ |
| **Tushare** | ✅ 延迟15分 | ✅ 全量 | ✅ | 需积分 | ⭐⭐⭐⭐ |
| **BaoStock** | ✅ 延迟15分 | ✅ 全量 | ✅ | 无限制 | ⭐⭐⭐⭐ |
| 新浪财经 | ✅ 实时 | ❌ | ❌ | 可能被封 | ⭐⭐⭐ |
| 东方财富 | ✅ 实时 | ✅ | ✅ | 可能被封 | ⭐⭐⭐ |

### 1.2 推荐方案

**主数据源**: AKShare (Python)
- 完全免费，无限制
- 数据全面 (行情 + K线 + 基本面 + 新闻)
- 活跃维护
- 文档完善

**备用数据源**: 东方财富 API
- 实时行情补充
- 作为 fallback

---

## 2. 服务架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Quote Service (Python)                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │  AKShare    │    │   Redis     │    │  PostgreSQL │    │
│   │  (数据源)   │───▶│   (缓存)    │◀───│   (持久化)  │    │
│   └─────────────┘    └─────────────┘    └─────────────┘    │
│                            │                                │
│                            ▼                                │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              FastAPI HTTP Server                    │  │
│   │              /quotes /kline /search /news           │  │
│   └─────────────────────────────────────────────────────┘  │
│                            │                                │
└────────────────────────────│────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Main API (Node.js)                      │
│                                                             │
│   GET /market/quotes?codes=SH600900,SZ000001               │
│   GET /market/kline/SH600900?period=day&count=100          │
│   GET /market/search?q=长江                                 │
│   GET /market/stocks/SH600900                               │
│   GET /market/stocks/SH600900/news                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Python Quote Service

### 3.1 项目结构

```
apps/quote-service/
├── main.py                 # FastAPI 入口
├── config.py               # 配置
├── services/
│   ├── akshare_client.py   # AKShare 封装
│   ├── quote_service.py    # 行情服务
│   ├── kline_service.py    # K线服务
│   ├── news_service.py     # 新闻服务
│   └── cache_service.py    # 缓存服务
├── models/
│   └── schemas.py          # Pydantic 模型
├── tasks/
│   ├── scheduler.py        # 定时任务
│   └── update_quotes.py    # 更新行情
├── requirements.txt
└── Dockerfile
```

### 3.2 核心代码

```python
# main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from config import settings
from services.quote_service import QuoteService
from services.kline_service import KlineService
from services.news_service import NewsService
from tasks.scheduler import start_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_scheduler()
    yield
    # Shutdown
    pass

app = FastAPI(
    title="AI Stock Arena - Quote Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

quote_service = QuoteService()
kline_service = KlineService()
news_service = NewsService()


@app.get("/quotes")
async def get_quotes(codes: str):
    """
    获取实时行情
    
    Args:
        codes: 股票代码，逗号分隔，如 "SH600900,SZ000001"
    
    Returns:
        行情列表
    """
    code_list = [c.strip() for c in codes.split(",") if c.strip()]
    
    if len(code_list) > 20:
        raise HTTPException(400, "最多查询20只股票")
    
    quotes = await quote_service.get_quotes(code_list)
    return {"success": True, "data": quotes}


@app.get("/kline/{code}")
async def get_kline(
    code: str,
    period: str = "day",
    count: int = 100,
    end_date: str = None,
):
    """
    获取K线数据
    
    Args:
        code: 股票代码
        period: 周期 (1/5/15/30/60/day/week/month)
        count: 数量
        end_date: 结束日期 (YYYY-MM-DD)
    
    Returns:
        K线数据
    """
    if count > 500:
        raise HTTPException(400, "最多500条")
    
    klines = await kline_service.get_kline(code, period, count, end_date)
    return {"success": True, "data": klines}


@app.get("/search")
async def search_stocks(q: str, limit: int = 10):
    """
    搜索股票
    
    Args:
        q: 搜索关键词
        limit: 返回数量
    
    Returns:
        匹配的股票列表
    """
    results = await quote_service.search(q, limit)
    return {"success": True, "data": results}


@app.get("/stocks/{code}")
async def get_stock_detail(code: str):
    """
    获取股票详情 (行情 + 基本面)
    """
    detail = await quote_service.get_stock_detail(code)
    if not detail:
        raise HTTPException(404, "股票不存在")
    return {"success": True, "data": detail}


@app.get("/stocks/{code}/news")
async def get_stock_news(code: str, limit: int = 10):
    """
    获取股票相关新闻
    """
    news = await news_service.get_stock_news(code, limit)
    return {"success": True, "data": news}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
```

### 3.3 AKShare 封装

```python
# services/akshare_client.py

import akshare as ak
import pandas as pd
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import asyncio
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)


class AKShareClient:
    """AKShare 数据源封装"""
    
    def __init__(self):
        self._stock_list_cache = None
        self._stock_list_updated = None
    
    async def get_realtime_quotes(self, codes: List[str]) -> List[Dict]:
        """
        获取实时行情
        
        注意: AKShare 的实时行情有15分钟延迟
        """
        try:
            # 转换代码格式: SH600900 -> sh600900
            formatted_codes = [c.lower() for c in codes]
            
            # 获取实时行情
            df = await asyncio.to_thread(
                ak.stock_zh_a_spot_em
            )
            
            # 筛选需要的股票
            results = []
            for code in codes:
                # 提取数字部分
                stock_code = code[2:]  # 600900
                market = code[:2].upper()  # SH
                
                row = df[df['代码'] == stock_code]
                if row.empty:
                    continue
                
                row = row.iloc[0]
                results.append({
                    'code': code,
                    'name': row['名称'],
                    'price': float(row['最新价']) if pd.notna(row['最新价']) else None,
                    'change': float(row['涨跌额']) if pd.notna(row['涨跌额']) else None,
                    'changePct': float(row['涨跌幅']) / 100 if pd.notna(row['涨跌幅']) else None,
                    'open': float(row['今开']) if pd.notna(row['今开']) else None,
                    'high': float(row['最高']) if pd.notna(row['最高']) else None,
                    'low': float(row['最低']) if pd.notna(row['最低']) else None,
                    'preClose': float(row['昨收']) if pd.notna(row['昨收']) else None,
                    'volume': int(row['成交量']) if pd.notna(row['成交量']) else None,
                    'amount': int(row['成交额']) if pd.notna(row['成交额']) else None,
                })
            
            return results
            
        except Exception as e:
            logger.error(f"获取实时行情失败: {e}")
            raise
    
    async def get_kline(
        self,
        code: str,
        period: str = "daily",
        count: int = 100,
        end_date: str = None,
    ) -> Dict:
        """
        获取K线数据
        """
        try:
            stock_code = code[2:]  # 600900
            
            # 映射周期
            period_map = {
                "1": "1",
                "5": "5",
                "15": "15",
                "30": "30",
                "60": "60",
                "day": "daily",
                "week": "weekly",
                "month": "monthly",
            }
            ak_period = period_map.get(period, "daily")
            
            if ak_period in ["1", "5", "15", "30", "60"]:
                # 分钟K线
                df = await asyncio.to_thread(
                    ak.stock_zh_a_minute,
                    symbol=stock_code,
                    period=ak_period,
                )
            else:
                # 日/周/月K线
                df = await asyncio.to_thread(
                    ak.stock_zh_a_hist,
                    symbol=stock_code,
                    period=ak_period,
                    adjust="qfq",  # 前复权
                )
            
            # 取最后 count 条
            df = df.tail(count)
            
            klines = []
            for _, row in df.iterrows():
                klines.append({
                    'time': str(row['日期']) if '日期' in row else str(row['时间']),
                    'open': float(row['开盘']),
                    'high': float(row['最高']),
                    'low': float(row['最低']),
                    'close': float(row['收盘']),
                    'volume': int(row['成交量']) if '成交量' in row else int(row['成交额']),
                })
            
            # 获取股票名称
            name = await self.get_stock_name(code)
            
            return {
                'code': code,
                'name': name,
                'period': period,
                'klines': klines,
            }
            
        except Exception as e:
            logger.error(f"获取K线失败: {e}")
            raise
    
    async def get_stock_info(self, code: str) -> Optional[Dict]:
        """
        获取股票基本信息
        """
        try:
            stock_code = code[2:]
            
            # 个股信息
            df = await asyncio.to_thread(
                ak.stock_individual_info_em,
                symbol=stock_code,
            )
            
            info = {}
            for _, row in df.iterrows():
                info[row['item']] = row['value']
            
            return {
                'code': code,
                'name': info.get('股票简称'),
                'market': code[:2],
                'industry': info.get('行业'),
                'pe': float(info.get('市盈率(动态)', 0)) if info.get('市盈率(动态)') else None,
                'pb': float(info.get('市净率', 0)) if info.get('市净率') else None,
                'marketCap': int(float(info.get('总市值', 0))) if info.get('总市值') else None,
                'totalShares': int(float(info.get('总股本', 0))) if info.get('总股本') else None,
                'floatShares': int(float(info.get('流通股', 0))) if info.get('流通股') else None,
            }
            
        except Exception as e:
            logger.error(f"获取股票信息失败: {e}")
            return None
    
    async def search_stocks(self, keyword: str, limit: int = 10) -> List[Dict]:
        """
        搜索股票
        """
        # 获取全部股票列表 (缓存)
        stock_list = await self._get_stock_list()
        
        # 搜索匹配
        results = []
        keyword_lower = keyword.lower()
        
        for stock in stock_list:
            code = stock['code']
            name = stock['name']
            
            # 代码或名称匹配
            if keyword_lower in code.lower() or keyword in name:
                results.append(stock)
                if len(results) >= limit:
                    break
        
        return results
    
    async def _get_stock_list(self) -> List[Dict]:
        """
        获取全部 A 股列表 (缓存1天)
        """
        now = datetime.now()
        
        if (
            self._stock_list_cache is not None
            and self._stock_list_updated is not None
            and (now - self._stock_list_updated) < timedelta(days=1)
        ):
            return self._stock_list_cache
        
        df = await asyncio.to_thread(ak.stock_zh_a_spot_em)
        
        self._stock_list_cache = [
            {
                'code': f"{'SH' if str(row['代码']).startswith('6') else 'SZ'}{row['代码']}",
                'name': row['名称'],
            }
            for _, row in df.iterrows()
        ]
        self._stock_list_updated = now
        
        return self._stock_list_cache
    
    async def get_stock_name(self, code: str) -> str:
        """获取股票名称"""
        stock_list = await self._get_stock_list()
        for stock in stock_list:
            if stock['code'] == code:
                return stock['name']
        return ""
    
    async def get_stock_news(self, code: str, limit: int = 10) -> List[Dict]:
        """
        获取股票新闻
        """
        try:
            stock_code = code[2:]
            
            df = await asyncio.to_thread(
                ak.stock_news_em,
                symbol=stock_code,
            )
            
            news = []
            for _, row in df.head(limit).iterrows():
                news.append({
                    'title': row['新闻标题'],
                    'source': row['新闻来源'],
                    'time': str(row['发布时间']),
                    'url': row['新闻链接'],
                })
            
            return news
            
        except Exception as e:
            logger.error(f"获取新闻失败: {e}")
            return []
```

### 3.4 缓存服务

```python
# services/cache_service.py

import redis.asyncio as redis
import json
from typing import Optional, List, Dict
from config import settings

class CacheService:
    def __init__(self):
        self.redis = redis.from_url(settings.REDIS_URL)
    
    async def get_quotes(self, codes: List[str]) -> Optional[List[Dict]]:
        """获取缓存的行情"""
        pipeline = self.redis.pipeline()
        for code in codes:
            pipeline.hgetall(f"stock:quote:{code}")
        
        results = await pipeline.execute()
        
        quotes = []
        for i, result in enumerate(results):
            if result:
                quote = {k.decode(): self._decode_value(v) for k, v in result.items()}
                quote['code'] = codes[i]
                quotes.append(quote)
        
        return quotes if quotes else None
    
    async def set_quotes(self, quotes: List[Dict], ttl: int = 10):
        """缓存行情 (10秒过期)"""
        pipeline = self.redis.pipeline()
        
        for quote in quotes:
            code = quote['code']
            key = f"stock:quote:{code}"
            
            # 转换为 hash
            data = {k: str(v) if v is not None else '' for k, v in quote.items() if k != 'code'}
            
            pipeline.hset(key, mapping=data)
            pipeline.expire(key, ttl)
        
        await pipeline.execute()
    
    async def get_kline(self, code: str, period: str, count: int) -> Optional[Dict]:
        """获取缓存的K线"""
        key = f"stock:kline:{code}:{period}:{count}"
        data = await self.redis.get(key)
        return json.loads(data) if data else None
    
    async def set_kline(self, code: str, period: str, count: int, data: Dict, ttl: int = 60):
        """缓存K线 (1分钟过期)"""
        key = f"stock:kline:{code}:{period}:{count}"
        await self.redis.setex(key, ttl, json.dumps(data))
    
    def _decode_value(self, v: bytes):
        """解码值"""
        s = v.decode()
        if s == '':
            return None
        try:
            return float(s)
        except ValueError:
            return s
```

### 3.5 定时任务

```python
# tasks/scheduler.py

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from tasks.update_quotes import update_all_quotes, update_stock_list
import logging

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

def start_scheduler():
    """启动定时任务"""
    
    # 交易时段每5分钟更新行情
    # 09:30-11:30, 13:00-15:00 北京时间 = 01:30-03:30, 05:00-07:00 UTC
    scheduler.add_job(
        update_all_quotes,
        CronTrigger(
            minute='*/5',
            hour='1-3,5-7',
            day_of_week='mon-fri',
            timezone='UTC',
        ),
        id='update_quotes',
        replace_existing=True,
    )
    
    # 每天 00:00 UTC 更新股票列表
    scheduler.add_job(
        update_stock_list,
        CronTrigger(hour=0, minute=0, timezone='UTC'),
        id='update_stock_list',
        replace_existing=True,
    )
    
    scheduler.start()
    logger.info("Scheduler started")
```

```python
# tasks/update_quotes.py

from services.akshare_client import AKShareClient
from services.cache_service import CacheService
import logging

logger = logging.getLogger(__name__)
akshare = AKShareClient()
cache = CacheService()


async def update_all_quotes():
    """更新全部股票行情到 Redis"""
    try:
        logger.info("Updating all quotes...")
        
        # 获取全部股票列表
        stock_list = await akshare._get_stock_list()
        codes = [s['code'] for s in stock_list]
        
        # 分批获取 (每批100只)
        batch_size = 100
        for i in range(0, len(codes), batch_size):
            batch_codes = codes[i:i+batch_size]
            quotes = await akshare.get_realtime_quotes(batch_codes)
            await cache.set_quotes(quotes)
        
        logger.info(f"Updated {len(codes)} quotes")
        
    except Exception as e:
        logger.error(f"Failed to update quotes: {e}")


async def update_stock_list():
    """更新股票列表缓存"""
    try:
        logger.info("Updating stock list...")
        await akshare._get_stock_list()
        logger.info("Stock list updated")
    except Exception as e:
        logger.error(f"Failed to update stock list: {e}")
```

---

## 4. Node.js API 集成

### 4.1 调用 Quote Service

```typescript
// services/market-service.ts

import axios from 'axios';
import { config } from '../config';

const quoteClient = axios.create({
  baseURL: config.QUOTE_SERVICE_URL,  // http://quote-service:8001
  timeout: 5000,
});

export class MarketService {
  
  async getQuotes(codes: string[]): Promise<Quote[]> {
    const { data } = await quoteClient.get('/quotes', {
      params: { codes: codes.join(',') },
    });
    
    if (!data.success) {
      throw new Error(data.error?.message || 'Failed to get quotes');
    }
    
    return data.data.map((q: any) => ({
      code: q.code,
      name: q.name,
      price: q.price,
      change: q.change,
      changePct: q.changePct,
      open: q.open,
      high: q.high,
      low: q.low,
      preClose: q.preClose,
      volume: q.volume,
      amount: q.amount,
      time: new Date().toISOString(),
    }));
  }
  
  async getKline(code: string, period: string, count: number): Promise<Kline> {
    const { data } = await quoteClient.get(`/kline/${code}`, {
      params: { period, count },
    });
    
    if (!data.success) {
      throw new Error(data.error?.message || 'Failed to get kline');
    }
    
    return data.data;
  }
  
  async searchStocks(query: string, limit: number = 10): Promise<StockSearchResult[]> {
    const { data } = await quoteClient.get('/search', {
      params: { q: query, limit },
    });
    
    if (!data.success) {
      throw new Error(data.error?.message || 'Failed to search');
    }
    
    return data.data;
  }
  
  async getStockDetail(code: string): Promise<StockDetail> {
    const { data } = await quoteClient.get(`/stocks/${code}`);
    
    if (!data.success) {
      throw new Error(data.error?.message || 'Stock not found');
    }
    
    return data.data;
  }
  
  async getStockNews(code: string, limit: number = 10): Promise<StockNews[]> {
    const { data } = await quoteClient.get(`/stocks/${code}/news`, {
      params: { limit },
    });
    
    if (!data.success) {
      throw new Error(data.error?.message || 'Failed to get news');
    }
    
    return data.data;
  }
}

// Types
interface Quote {
  code: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  preClose: number;
  volume: number;
  amount: number;
  time: string;
}

interface Kline {
  code: string;
  name: string;
  period: string;
  klines: {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
}

interface StockSearchResult {
  code: string;
  name: string;
}

interface StockDetail {
  code: string;
  name: string;
  market: string;
  industry: string;
  quote: Quote;
  fundamentals: {
    pe: number;
    pb: number;
    marketCap: number;
    totalShares: number;
    floatShares: number;
    dividendYield: number;
  };
}

interface StockNews {
  title: string;
  source: string;
  time: string;
  url: string;
}
```

---

## 5. Docker 配置

```dockerfile
# apps/quote-service/Dockerfile

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Expose port
EXPOSE 8001

# Run
CMD ["python", "main.py"]
```

```txt
# apps/quote-service/requirements.txt

fastapi==0.109.0
uvicorn==0.27.0
akshare==1.12.0
pandas==2.2.0
redis==5.0.1
apscheduler==3.10.4
httpx==0.26.0
python-dotenv==1.0.0
```

```yaml
# docker-compose.yml (补充)

services:
  quote-service:
    build: ./apps/quote-service
    ports:
      - "8001:8001"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped
```

---

## 6. 性能优化

### 6.1 缓存策略

| 数据类型 | 缓存位置 | TTL | 更新策略 |
|----------|----------|-----|----------|
| 实时行情 | Redis | 10s | 交易时段每5分钟批量更新 |
| 日K线 | Redis | 5min | 按需获取 + 缓存 |
| 分钟K线 | Redis | 1min | 按需获取 + 缓存 |
| 股票列表 | 内存 | 1天 | 每日更新 |
| 股票基本面 | Redis | 1天 | 每日更新 |

### 6.2 限流

```python
# 限制单 IP 请求频率
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/quotes")
@limiter.limit("60/minute")
async def get_quotes(request: Request, codes: str):
    ...
```

---

## 7. 监控

```python
# 健康检查 + Prometheus metrics

from prometheus_client import Counter, Histogram, generate_latest
from starlette.responses import Response

QUOTE_REQUESTS = Counter('quote_requests_total', 'Total quote requests')
QUOTE_LATENCY = Histogram('quote_latency_seconds', 'Quote request latency')

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type="text/plain")
```

---

*行情服务设计文档结束*
