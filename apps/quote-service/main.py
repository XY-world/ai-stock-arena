"""
AI Stock Arena - 行情服务
使用 AKShare 获取 A 股实时行情
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import akshare as ak
import redis
import json
from datetime import datetime, timedelta
from typing import Optional
import os

app = FastAPI(title="AI Stock Arena Quote Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis 连接
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(redis_url, decode_responses=True)

CACHE_TTL = 10  # 行情缓存 10 秒


def normalize_code(code: str) -> tuple[str, str]:
    """
    标准化股票代码
    输入: SH600900 或 600900.SH
    输出: (600900, sh) for akshare
    """
    code = code.upper().replace(".", "")
    
    if code.startswith("SH"):
        return code[2:], "sh"
    elif code.startswith("SZ"):
        return code[2:], "sz"
    else:
        # 根据代码判断
        if code.startswith("6"):
            return code, "sh"
        else:
            return code, "sz"


def format_code(code: str, market: str) -> str:
    """格式化为标准代码 SH600900"""
    return f"{market.upper()}{code}"


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get("/quotes/{code}")
async def get_quote(code: str):
    """
    获取单只股票实时行情
    """
    cache_key = f"quote:{code}"
    
    # 检查缓存
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    try:
        raw_code, market = normalize_code(code)
        symbol = f"{raw_code}"
        
        # 获取实时行情
        df = ak.stock_zh_a_spot_em()
        row = df[df["代码"] == raw_code]
        
        if row.empty:
            raise HTTPException(status_code=404, detail=f"Stock {code} not found")
        
        row = row.iloc[0]
        
        result = {
            "code": format_code(raw_code, market),
            "name": row["名称"],
            "price": float(row["最新价"]) if row["最新价"] else 0,
            "preClose": float(row["昨收"]) if row["昨收"] else 0,
            "open": float(row["今开"]) if row["今开"] else 0,
            "high": float(row["最高"]) if row["最高"] else 0,
            "low": float(row["最低"]) if row["最低"] else 0,
            "volume": int(row["成交量"]) if row["成交量"] else 0,
            "amount": float(row["成交额"]) if row["成交额"] else 0,
            "changePct": float(row["涨跌幅"]) / 100 if row["涨跌幅"] else 0,
            "change": float(row["涨跌额"]) if row["涨跌额"] else 0,
            "turnover": float(row["换手率"]) / 100 if row["换手率"] else 0,
            "pe": float(row["市盈率-动态"]) if row["市盈率-动态"] else None,
            "pb": float(row["市净率"]) if row["市净率"] else None,
            "marketCap": float(row["总市值"]) if row["总市值"] else None,
            "timestamp": datetime.now().isoformat(),
        }
        
        # 缓存
        redis_client.setex(cache_key, CACHE_TTL, json.dumps(result))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/quotes")
async def get_quotes(codes: str):
    """
    批量获取股票行情
    codes: 逗号分隔的股票代码
    """
    code_list = [c.strip() for c in codes.split(",")]
    results = []
    
    for code in code_list[:20]:  # 最多 20 个
        try:
            quote = await get_quote(code)
            results.append(quote)
        except:
            pass
    
    return results


@app.get("/kline/{code}")
async def get_kline(
    code: str,
    period: str = "daily",
    count: int = 100,
):
    """
    获取 K 线数据
    period: daily, weekly, monthly
    """
    cache_key = f"kline:{code}:{period}:{count}"
    
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    try:
        raw_code, market = normalize_code(code)
        
        # 获取 K 线
        if period == "daily":
            df = ak.stock_zh_a_hist(
                symbol=raw_code,
                period="daily",
                adjust="qfq",
            )
        elif period == "weekly":
            df = ak.stock_zh_a_hist(
                symbol=raw_code,
                period="weekly",
                adjust="qfq",
            )
        else:
            df = ak.stock_zh_a_hist(
                symbol=raw_code,
                period="monthly",
                adjust="qfq",
            )
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No data")
        
        # 取最近 count 条
        df = df.tail(count)
        
        result = []
        for _, row in df.iterrows():
            result.append({
                "date": str(row["日期"]),
                "open": float(row["开盘"]),
                "high": float(row["最高"]),
                "low": float(row["最低"]),
                "close": float(row["收盘"]),
                "volume": int(row["成交量"]),
                "amount": float(row["成交额"]),
            })
        
        # 缓存 1 小时
        redis_client.setex(cache_key, 3600, json.dumps(result))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/hot")
async def get_hot_stocks():
    """
    获取热门股票
    """
    cache_key = "hot_stocks"
    
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    try:
        # 获取涨幅榜
        df = ak.stock_zh_a_spot_em()
        df = df.sort_values("涨跌幅", ascending=False).head(20)
        
        result = []
        for _, row in df.iterrows():
            code = row["代码"]
            market = "SH" if code.startswith("6") else "SZ"
            
            result.append({
                "code": f"{market}{code}",
                "name": row["名称"],
                "price": float(row["最新价"]) if row["最新价"] else 0,
                "changePct": float(row["涨跌幅"]) / 100 if row["涨跌幅"] else 0,
            })
        
        # 缓存 5 分钟
        redis_client.setex(cache_key, 300, json.dumps(result))
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/overview")
async def get_market_overview():
    """
    获取市场概况
    """
    cache_key = "market_overview"
    
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    try:
        # 获取指数
        df = ak.stock_zh_index_spot_em()
        
        indices = {}
        for name, code in [
            ("上证指数", "000001"),
            ("深证成指", "399001"),
            ("创业板指", "399006"),
            ("科创50", "000688"),
        ]:
            row = df[df["代码"] == code]
            if not row.empty:
                row = row.iloc[0]
                indices[name] = {
                    "code": code,
                    "price": float(row["最新价"]),
                    "changePct": float(row["涨跌幅"]) / 100,
                }
        
        # 涨跌家数
        all_stocks = ak.stock_zh_a_spot_em()
        up_count = len(all_stocks[all_stocks["涨跌幅"] > 0])
        down_count = len(all_stocks[all_stocks["涨跌幅"] < 0])
        flat_count = len(all_stocks[all_stocks["涨跌幅"] == 0])
        
        result = {
            "indices": indices,
            "upCount": up_count,
            "downCount": down_count,
            "flatCount": flat_count,
            "timestamp": datetime.now().isoformat(),
        }
        
        # 缓存 1 分钟
        redis_client.setex(cache_key, 60, json.dumps(result))
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search")
async def search_stocks(q: str, limit: int = 10):
    """
    搜索股票
    """
    if not q:
        return []
    
    try:
        df = ak.stock_zh_a_spot_em()
        
        # 按代码或名称搜索
        matches = df[
            df["代码"].str.contains(q, case=False) |
            df["名称"].str.contains(q, case=False)
        ].head(limit)
        
        result = []
        for _, row in matches.iterrows():
            code = row["代码"]
            market = "SH" if code.startswith("6") else "SZ"
            
            result.append({
                "code": f"{market}{code}",
                "name": row["名称"],
                "price": float(row["最新价"]) if row["最新价"] else 0,
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
