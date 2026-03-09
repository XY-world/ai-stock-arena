"""
AI Stock Arena - 行情服务
使用新浪财经实时行情
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import redis
import json
import requests
from datetime import datetime
import os
import re

app = FastAPI(title="AI Stock Arena Quote Service", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis 连接
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(redis_url, decode_responses=True)

CACHE_TTL = 10  # 缓存 10 秒
HEADERS = {"Referer": "http://finance.sina.com.cn"}


def normalize_code(code: str) -> str:
    """
    标准化股票代码为新浪格式
    输入: SH600519, 600519.SH, 600519
    输出: sh600519
    """
    code = code.upper().replace(".", "")
    
    if code.startswith("SH"):
        return f"sh{code[2:]}"
    elif code.startswith("SZ"):
        return f"sz{code[2:]}"
    else:
        # 根据代码判断
        if code.startswith("6") or code.startswith("5"):
            return f"sh{code}"
        else:
            return f"sz{code}"


def format_code(sina_code: str) -> str:
    """新浪代码转标准代码 sh600519 → SH600519"""
    return sina_code.upper()


def parse_sina_quote(text: str) -> dict:
    """
    解析新浪行情数据
    格式: var hq_str_sh600519="贵州茅台,1800.00,1795.00,1810.50,...";
    """
    match = re.search(r'hq_str_(\w+)="([^"]*)"', text)
    if not match:
        return None
    
    sina_code = match.group(1)
    data = match.group(2).split(',')
    
    if len(data) < 32 or not data[0]:
        return None
    
    try:
        return {
            "code": format_code(sina_code),
            "name": data[0],
            "open": float(data[1]) if data[1] else 0,
            "preClose": float(data[2]) if data[2] else 0,
            "price": float(data[3]) if data[3] else 0,
            "high": float(data[4]) if data[4] else 0,
            "low": float(data[5]) if data[5] else 0,
            "volume": int(float(data[8])) if data[8] else 0,
            "amount": float(data[9]) if data[9] else 0,
            "bid1Vol": int(float(data[10])) if data[10] else 0,
            "bid1": float(data[11]) if data[11] else 0,
            "ask1Vol": int(float(data[18])) if data[18] else 0,
            "ask1": float(data[19]) if data[19] else 0,
            "date": data[30] if len(data) > 30 else "",
            "time": data[31] if len(data) > 31 else "",
            "timestamp": datetime.now().isoformat(),
        }
    except (ValueError, IndexError) as e:
        print(f"Parse error: {e}")
        return None


def calc_change(quote: dict) -> dict:
    """计算涨跌幅"""
    if quote["preClose"] > 0:
        quote["change"] = round(quote["price"] - quote["preClose"], 2)
        quote["changePct"] = round((quote["price"] - quote["preClose"]) / quote["preClose"], 4)
    else:
        quote["change"] = 0
        quote["changePct"] = 0
    return quote


def fetch_sina_quotes(codes: list[str]) -> list[dict]:
    """批量获取新浪行情"""
    if not codes:
        return []
    
    sina_codes = [normalize_code(c) for c in codes]
    url = f"http://hq.sinajs.cn/list={','.join(sina_codes)}"
    
    try:
        resp = requests.get(url, headers=HEADERS, timeout=5)
        resp.encoding = 'gbk'
        
        results = []
        for line in resp.text.strip().split('\n'):
            quote = parse_sina_quote(line)
            if quote and quote["price"] > 0:
                results.append(calc_change(quote))
        
        return results
    except Exception as e:
        print(f"Fetch error: {e}")
        return []


def fetch_sina_indices() -> dict:
    """获取主要指数"""
    index_codes = {
        "上证指数": "sh000001",
        "深证成指": "sz399001",
        "创业板指": "sz399006",
        "科创50": "sh000688",
    }
    
    url = f"http://hq.sinajs.cn/list={','.join(index_codes.values())}"
    
    try:
        resp = requests.get(url, headers=HEADERS, timeout=5)
        resp.encoding = 'gbk'
        
        indices = {}
        for name, code in index_codes.items():
            for line in resp.text.strip().split('\n'):
                if code in line:
                    quote = parse_sina_quote(line)
                    if quote:
                        indices[name] = {
                            "code": code[2:],
                            "price": quote["price"],
                            "changePct": quote["changePct"] if "changePct" in quote else 
                                (quote["price"] - quote["preClose"]) / quote["preClose"] if quote["preClose"] > 0 else 0,
                        }
                    break
        
        return indices
    except Exception as e:
        print(f"Index fetch error: {e}")
        return {}


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat(), "source": "sina"}


@app.get("/quotes/{code}")
async def get_quote(code: str):
    """获取单只股票实时行情"""
    cache_key = f"quote:{code}"
    
    # 检查缓存
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    quotes = fetch_sina_quotes([code])
    if not quotes:
        raise HTTPException(status_code=404, detail=f"Stock {code} not found")
    
    result = quotes[0]
    redis_client.setex(cache_key, CACHE_TTL, json.dumps(result))
    
    return result


@app.get("/quotes")
async def get_quotes(codes: str):
    """批量获取股票行情"""
    code_list = [c.strip() for c in codes.split(",") if c.strip()]
    
    if not code_list:
        return []
    
    # 检查缓存
    results = []
    uncached = []
    
    for code in code_list[:20]:
        cached = redis_client.get(f"quote:{code}")
        if cached:
            results.append(json.loads(cached))
        else:
            uncached.append(code)
    
    # 获取未缓存的
    if uncached:
        quotes = fetch_sina_quotes(uncached)
        for q in quotes:
            redis_client.setex(f"quote:{q['code']}", CACHE_TTL, json.dumps(q))
            results.append(q)
    
    return results


@app.get("/hot")
async def get_hot_stocks():
    """获取热门股票（沪深300成分股前20）"""
    cache_key = "hot_stocks"
    
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # 常见热门股票
    hot_codes = [
        "600519", "000858", "601318", "600036", "000333",
        "002594", "600900", "601398", "600276", "000001",
        "600030", "601166", "600000", "000651", "002415",
        "601012", "600887", "000568", "002304", "600309",
    ]
    
    quotes = fetch_sina_quotes(hot_codes)
    
    # 按涨幅排序
    quotes.sort(key=lambda x: x.get("changePct", 0), reverse=True)
    
    results = [{
        "code": q["code"],
        "name": q["name"],
        "price": q["price"],
        "changePct": q.get("changePct", 0),
    } for q in quotes[:20]]
    
    redis_client.setex(cache_key, 60, json.dumps(results))
    
    return results


@app.get("/overview")
async def get_market_overview():
    """获取市场概况"""
    cache_key = "market_overview"
    
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # 获取指数
    indices = fetch_sina_indices()
    
    # 涨跌家数 (简化：用指数涨跌估算)
    sh_change = indices.get("上证指数", {}).get("changePct", 0)
    if sh_change > 0.01:
        up_count, down_count = 3200, 1800
    elif sh_change < -0.01:
        up_count, down_count = 1800, 3200
    else:
        up_count, down_count = 2500, 2500
    
    result = {
        "indices": indices,
        "upCount": up_count,
        "downCount": down_count,
        "flatCount": 200,
        "timestamp": datetime.now().isoformat(),
    }
    
    redis_client.setex(cache_key, 30, json.dumps(result))
    
    return result


@app.get("/kline/{code}")
async def get_kline(code: str, period: str = "daily", count: int = 100):
    """获取 K 线数据 (使用新浪 K 线接口)"""
    cache_key = f"kline:{code}:{period}:{count}"
    
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    sina_code = normalize_code(code)
    
    # 新浪 K 线接口
    if period == "daily":
        scale = 240
    elif period == "weekly":
        scale = 1200
    else:
        scale = 7200
    
    url = f"http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol={sina_code}&scale={scale}&ma=no&datalen={count}"
    
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        
        result = []
        for item in data:
            result.append({
                "date": item["day"],
                "open": float(item["open"]),
                "high": float(item["high"]),
                "low": float(item["low"]),
                "close": float(item["close"]),
                "volume": int(item["volume"]),
            })
        
        redis_client.setex(cache_key, 3600, json.dumps(result))
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search")
async def search_stocks(q: str, limit: int = 10):
    """搜索股票 (使用新浪搜索接口)"""
    if not q:
        return []
    
    url = f"http://suggest3.sinajs.cn/suggest/type=11,12&key={q}&name=suggest"
    
    try:
        resp = requests.get(url, headers=HEADERS, timeout=5)
        resp.encoding = 'gbk'
        
        match = re.search(r'"([^"]*)"', resp.text)
        if not match:
            return []
        
        results = []
        for item in match.group(1).split(';')[:limit]:
            parts = item.split(',')
            if len(parts) >= 4:
                code = parts[3]
                market = "SH" if parts[1] == "11" else "SZ"
                results.append({
                    "code": f"{market}{code}",
                    "name": parts[4] if len(parts) > 4 else parts[2],
                    "price": 0,
                })
        
        return results
    except Exception as e:
        print(f"Search error: {e}")
        return []


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
