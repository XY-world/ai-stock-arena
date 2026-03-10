"""
AI 股场 - 行情服务 (新浪财经数据源)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import re
from datetime import datetime, timedelta
import random
import numpy as np

app = FastAPI(title="AI Stock Arena - Quote Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 新浪财经接口
SINA_API = "http://hq.sinajs.cn/list="
SINA_HEADERS = {"Referer": "https://finance.sina.com.cn"}

# 股票代码映射 (内部格式 -> 新浪格式)
def to_sina_code(code: str) -> str:
    """SH600519 -> sh600519"""
    return code.lower()

def from_sina_code(code: str) -> str:
    """sh600519 -> SH600519"""
    return code.upper()

# 热门股票列表
HOT_STOCKS = [
    "SH600519",  # 贵州茅台
    "SZ000001",  # 平安银行
    "SH601318",  # 中国平安
    "SZ000858",  # 五粮液
    "SH600036",  # 招商银行
    "SZ002594",  # 比亚迪
    "SH601012",  # 隆基绿能
    "SZ002415",  # 海康威视
    "SH600887",  # 伊利股份
    "SH600900",  # 长江电力
    "SH601398",  # 工商银行
    "SH600276",  # 恒瑞医药
    "SZ000333",  # 美的集团
    "SH600309",  # 万华化学
    "SZ002352",  # 顺丰控股
    "SH601888",  # 中国中免
    "SZ300750",  # 宁德时代
    "SH688981",  # 中芯国际
    "SZ000651",  # 格力电器
    "SH600030",  # 中信证券
]

# 指数代码
INDEX_CODES = {
    "上证指数": "sh000001",
    "深证成指": "sz399001",
    "创业板指": "sz399006",
    "科创50": "sh000688",
}


async def fetch_sina_quotes(codes: list[str]) -> dict:
    """从新浪获取行情数据"""
    sina_codes = [to_sina_code(c) for c in codes]
    url = SINA_API + ",".join(sina_codes)
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url, headers=SINA_HEADERS)
            resp.raise_for_status()
            return parse_sina_response(resp.text, codes)
        except Exception as e:
            print(f"Sina API error: {e}")
            return {}


def parse_sina_response(text: str, original_codes: list[str]) -> dict:
    """解析新浪返回数据"""
    result = {}
    
    # 匹配 var hq_str_sh600519="...";
    pattern = r'var hq_str_(\w+)="([^"]+)";'
    matches = re.findall(pattern, text)
    
    for sina_code, data_str in matches:
        if not data_str:
            continue
            
        parts = data_str.split(",")
        if len(parts) < 32:
            continue
        
        code = from_sina_code(sina_code)
        
        try:
            result[code] = {
                "code": code,
                "name": parts[0],
                "open": safe_float(parts[1]),
                "preClose": safe_float(parts[2]),
                "price": safe_float(parts[3]),
                "high": safe_float(parts[4]),
                "low": safe_float(parts[5]),
                "volume": safe_int(parts[8]),
                "amount": safe_float(parts[9]),
                "date": parts[30],
                "time": parts[31],
            }
            
            # 计算涨跌
            price = result[code]["price"]
            pre_close = result[code]["preClose"]
            if pre_close and pre_close > 0:
                result[code]["change"] = price - pre_close
                result[code]["changePct"] = (price - pre_close) / pre_close
            else:
                result[code]["change"] = 0
                result[code]["changePct"] = 0
                
        except Exception as e:
            print(f"Parse error for {sina_code}: {e}")
            continue
    
    return result


def safe_float(s: str) -> float:
    try:
        return float(s) if s else 0.0
    except:
        return 0.0

def safe_int(s: str) -> int:
    try:
        return int(float(s)) if s else 0
    except:
        return 0


@app.get("/")
async def root():
    return {"service": "AI Stock Arena Quote Service", "source": "sina"}


@app.get("/v1/market/quotes")
async def get_quotes(codes: str):
    """获取实时行情"""
    code_list = [c.strip().upper() for c in codes.split(",") if c.strip()]
    
    if not code_list:
        raise HTTPException(400, "codes parameter required")
    
    quotes = await fetch_sina_quotes(code_list)
    
    # 返回列表格式
    result = [quotes[c] for c in code_list if c in quotes]
    
    return {"success": True, "data": result}


@app.get("/v1/market/hot")
async def get_hot_stocks():
    """获取热门股票"""
    quotes = await fetch_sina_quotes(HOT_STOCKS)
    
    # 按涨跌幅排序
    result = sorted(
        [quotes[c] for c in HOT_STOCKS if c in quotes],
        key=lambda x: x.get("changePct", 0),
        reverse=True
    )
    
    return {"success": True, "data": result}


@app.get("/v1/market/overview")
async def get_market_overview():
    """获取市场概况"""
    # 获取指数数据
    index_codes_list = list(INDEX_CODES.values())
    url = SINA_API + ",".join(index_codes_list)
    
    indices = {}
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url, headers=SINA_HEADERS)
            pattern = r'var hq_str_(\w+)="([^"]+)";'
            matches = re.findall(pattern, resp.text)
            
            for sina_code, data_str in matches:
                if not data_str:
                    continue
                parts = data_str.split(",")
                if len(parts) < 4:
                    continue
                
                # 找到对应的中文名
                for name, code in INDEX_CODES.items():
                    if code == sina_code:
                        price = safe_float(parts[3])
                        pre_close = safe_float(parts[2])
                        indices[name] = {
                            "code": sina_code,
                            "price": price,
                            "changePct": (price - pre_close) / pre_close if pre_close else 0,
                        }
                        break
        except Exception as e:
            print(f"Index fetch error: {e}")
    
    # 涨跌家数 (模拟数据，实际需要另外接口)
    return {
        "success": True,
        "data": {
            "indices": indices,
            "upCount": 2500,
            "downCount": 2500,
            "flatCount": 200,
            "timestamp": datetime.now().isoformat(),
        }
    }


@app.get("/v1/market/kline/{code}")
async def get_kline(code: str, count: int = 60):
    """获取 K 线数据 (模拟数据)"""
    # 新浪的 K 线接口需要不同的处理，这里先用模拟数据
    # 实际可以用: http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData
    
    # 获取当前价格
    quotes = await fetch_sina_quotes([code.upper()])
    current_price = quotes.get(code.upper(), {}).get("price", 100)
    
    # 生成模拟 K 线
    kline = []
    base_price = current_price
    
    for i in range(count, 0, -1):
        date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        
        # 模拟价格波动
        change = random.uniform(-0.03, 0.03)
        open_price = base_price * (1 + random.uniform(-0.01, 0.01))
        close_price = base_price * (1 + change)
        high = max(open_price, close_price) * (1 + random.uniform(0, 0.02))
        low = min(open_price, close_price) * (1 - random.uniform(0, 0.02))
        volume = random.randint(1000000, 5000000)
        
        kline.append({
            "date": date,
            "open": round(open_price, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(close_price, 2),
            "volume": volume,
        })
        
        base_price = close_price
    
    return {"success": True, "data": kline}


# ========== 新闻资讯 ==========

SINA_NEWS_API = "https://feed.mix.sina.com.cn/api/roll/get"

@app.get("/v1/market/news")
async def get_news(code: str = None, limit: int = 20):
    """获取财经新闻
    
    - code: 股票代码 (可选，不传则返回综合快讯)
    - limit: 返回数量
    """
    params = {
        "pageid": "153",
        "num": min(limit, 50),
        "lid": "2509",  # 财经快讯
    }
    
    if code:
        # 提取纯数字代码
        stock_num = re.sub(r"[A-Za-z]", "", code)
        params["k"] = stock_num
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(
                SINA_NEWS_API, 
                params=params,
                headers={"Referer": "https://finance.sina.com.cn"}
            )
            resp.raise_for_status()
            data = resp.json()
            
            news_list = []
            for item in data.get("result", {}).get("data", []):
                news_list.append({
                    "id": item.get("docid", ""),
                    "title": item.get("title", ""),
                    "summary": item.get("intro", ""),
                    "source": item.get("media_name", ""),
                    "url": item.get("url", ""),
                    "time": datetime.fromtimestamp(int(item.get("ctime", 0))).isoformat() if item.get("ctime") else None,
                    "keywords": item.get("keywords", "").split(",") if item.get("keywords") else [],
                })
            
            return {"success": True, "data": news_list}
            
        except Exception as e:
            print(f"News API error: {e}")
            return {"success": False, "data": [], "error": str(e)}


@app.get("/v1/market/news/hot")
async def get_hot_news(limit: int = 10):
    """获取热门新闻"""
    return await get_news(limit=limit)


@app.get("/v1/market/news/stock/{code}")
async def get_stock_news(code: str, limit: int = 10):
    """获取个股新闻"""
    return await get_news(code=code, limit=limit)


# ========== 技术指标 ==========

SINA_KLINE_API = "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData"
TENCENT_API = "https://qt.gtimg.cn/q="

async def fetch_sina_kline(code: str, count: int = 100) -> list:
    """从新浪获取 K 线数据"""
    sina_code = to_sina_code(code)
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(
                SINA_KLINE_API,
                params={
                    "symbol": sina_code,
                    "scale": "240",  # 日线
                    "ma": "5,10,20,60",
                    "datalen": count,
                },
                headers=SINA_HEADERS
            )
            # 新浪返回的是 JS 数组格式
            text = resp.text.strip()
            if text.startswith('['):
                import json
                return json.loads(text)
            return []
        except Exception as e:
            print(f"Sina kline error: {e}")
            return []


def calculate_ema(prices: np.ndarray, period: int) -> np.ndarray:
    """计算 EMA"""
    ema = np.zeros_like(prices)
    ema[0] = prices[0]
    multiplier = 2 / (period + 1)
    for i in range(1, len(prices)):
        ema[i] = (prices[i] - ema[i-1]) * multiplier + ema[i-1]
    return ema


def calculate_macd(prices: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9) -> dict:
    """计算 MACD"""
    if len(prices) < slow + signal:
        return {"dif": 0, "dea": 0, "macd": 0, "signal": "neutral"}
    
    ema_fast = calculate_ema(prices, fast)
    ema_slow = calculate_ema(prices, slow)
    dif = ema_fast - ema_slow
    dea = calculate_ema(dif, signal)
    macd_hist = (dif - dea) * 2
    
    # 判断金叉/死叉
    signal_type = "neutral"
    if len(dif) >= 2:
        if dif[-1] > dea[-1] and dif[-2] <= dea[-2]:
            signal_type = "golden_cross"
        elif dif[-1] < dea[-1] and dif[-2] >= dea[-2]:
            signal_type = "death_cross"
        elif dif[-1] > dea[-1]:
            signal_type = "bullish"
        else:
            signal_type = "bearish"
    
    return {
        "dif": round(dif[-1], 3),
        "dea": round(dea[-1], 3),
        "macd": round(macd_hist[-1], 3),
        "signal": signal_type,
    }


def calculate_rsi(prices: np.ndarray, periods: list = [6, 12, 24]) -> dict:
    """计算 RSI"""
    result = {}
    
    for period in periods:
        if len(prices) < period + 1:
            result[f"rsi{period}"] = 50
            continue
        
        deltas = np.diff(prices)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = np.mean(gains[-period:])
        avg_loss = np.mean(losses[-period:])
        
        if avg_loss == 0:
            result[f"rsi{period}"] = 100
        else:
            rs = avg_gain / avg_loss
            result[f"rsi{period}"] = round(100 - (100 / (1 + rs)), 2)
    
    return result


def calculate_boll(prices: np.ndarray, period: int = 20, std_dev: float = 2) -> dict:
    """计算布林带"""
    if len(prices) < period:
        mid = prices[-1] if len(prices) > 0 else 0
        return {"upper": mid, "mid": mid, "lower": mid}
    
    mid = np.mean(prices[-period:])
    std = np.std(prices[-period:])
    
    return {
        "upper": round(mid + std_dev * std, 2),
        "mid": round(mid, 2),
        "lower": round(mid - std_dev * std, 2),
    }


def calculate_kdj(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, n: int = 9) -> dict:
    """计算 KDJ"""
    if len(closes) < n:
        return {"k": 50, "d": 50, "j": 50}
    
    # 计算 RSV
    low_n = np.min(lows[-n:])
    high_n = np.max(highs[-n:])
    
    if high_n == low_n:
        rsv = 50
    else:
        rsv = (closes[-1] - low_n) / (high_n - low_n) * 100
    
    # 简化计算 K, D, J
    k = rsv  # 实际应该用平滑，这里简化
    d = k
    j = 3 * k - 2 * d
    
    return {
        "k": round(k, 2),
        "d": round(d, 2),
        "j": round(j, 2),
    }


@app.get("/v1/market/indicators/{code}")
async def get_indicators(code: str, period: str = "daily"):
    """获取技术指标
    
    返回: MA, MACD, RSI, BOLL, KDJ 等技术指标
    """
    code = code.upper()
    
    # 获取 K 线数据
    kline = await fetch_sina_kline(code, 100)
    
    if not kline:
        return {"success": False, "error": "Failed to fetch kline data"}
    
    # 提取价格数据
    closes = np.array([safe_float(k.get("close", 0)) for k in kline])
    highs = np.array([safe_float(k.get("high", 0)) for k in kline])
    lows = np.array([safe_float(k.get("low", 0)) for k in kline])
    
    # 获取最新一条的 MA (新浪已计算好)
    latest = kline[-1] if kline else {}
    ma = {
        "ma5": safe_float(latest.get("ma_price5", 0)),
        "ma10": safe_float(latest.get("ma_price10", 0)),
        "ma20": safe_float(latest.get("ma_price20", 0)),
        "ma60": round(np.mean(closes[-60:]), 2) if len(closes) >= 60 else 0,
    }
    
    # 计算其他指标
    macd = calculate_macd(closes)
    rsi = calculate_rsi(closes)
    boll = calculate_boll(closes)
    kdj = calculate_kdj(highs, lows, closes)
    
    # 生成信号摘要
    signals = []
    trend = "neutral"
    
    # MA 金叉/死叉
    if ma["ma5"] > ma["ma10"] and ma["ma10"] > ma["ma20"]:
        signals.append("MA多头排列")
        trend = "bullish"
    elif ma["ma5"] < ma["ma10"] and ma["ma10"] < ma["ma20"]:
        signals.append("MA空头排列")
        trend = "bearish"
    
    # MACD 信号
    if macd["signal"] == "golden_cross":
        signals.append("MACD金叉")
    elif macd["signal"] == "death_cross":
        signals.append("MACD死叉")
    
    # RSI 超买超卖
    if rsi.get("rsi6", 50) > 80:
        signals.append("RSI超买")
    elif rsi.get("rsi6", 50) < 20:
        signals.append("RSI超卖")
    
    # 布林带位置
    current_price = closes[-1] if len(closes) > 0 else 0
    if current_price > boll["upper"]:
        signals.append("突破布林上轨")
    elif current_price < boll["lower"]:
        signals.append("跌破布林下轨")
    
    # 获取股票名称
    quotes = await fetch_sina_quotes([code])
    name = quotes.get(code, {}).get("name", code)
    
    return {
        "success": True,
        "data": {
            "code": code,
            "name": name,
            "price": current_price,
            "indicators": {
                "ma": ma,
                "macd": macd,
                "rsi": rsi,
                "boll": boll,
                "kdj": kdj,
            },
            "trend": trend,
            "signals": signals,
        }
    }


# ========== 估值/基本面 ==========

async def fetch_tencent_quote(code: str) -> dict:
    """从腾讯获取行情数据 (包含 PE/PB)"""
    tencent_code = to_sina_code(code)  # 格式相同
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                TENCENT_API + tencent_code,
                headers={"Referer": "https://gu.qq.com"}
            )
            text = resp.text
            
            # 解析腾讯数据格式
            # v_sz002594="51~比亚迪~002594~96.67~97.52~..."
            match = re.search(r'v_\w+="([^"]+)"', text)
            if not match:
                return {}
            
            parts = match.group(1).split("~")
            if len(parts) < 50:
                return {}
            
            return {
                "code": code,
                "name": parts[1],
                "price": safe_float(parts[3]),
                "preClose": safe_float(parts[4]),
                "open": safe_float(parts[5]),
                "high": safe_float(parts[33]) if len(parts) > 33 else 0,
                "low": safe_float(parts[34]) if len(parts) > 34 else 0,
                "pe": safe_float(parts[39]) if len(parts) > 39 else 0,  # PE
                "pb": safe_float(parts[46]) if len(parts) > 46 else 0,  # PB
                "marketCap": safe_float(parts[44]) if len(parts) > 44 else 0,  # 总市值(亿)
                "marketCapFloat": safe_float(parts[45]) if len(parts) > 45 else 0,  # 流通市值(亿)
                "totalShares": safe_float(parts[38]) if len(parts) > 38 else 0,  # 总股本
                "turnoverRate": safe_float(parts[38]) if len(parts) > 38 else 0,  # 换手率
            }
        except Exception as e:
            print(f"Tencent API error: {e}")
            return {}


@app.get("/v1/market/fundamental/{code}")
async def get_fundamental(code: str):
    """获取基本面/估值数据
    
    返回: PE, PB, 市值等估值指标
    """
    code = code.upper()
    
    # 从腾讯获取估值数据
    quote = await fetch_tencent_quote(code)
    
    if not quote:
        # 回退到新浪数据
        sina_quotes = await fetch_sina_quotes([code])
        if code in sina_quotes:
            quote = sina_quotes[code]
            quote["pe"] = 0
            quote["pb"] = 0
            quote["marketCap"] = 0
    
    if not quote:
        return {"success": False, "error": "Failed to fetch fundamental data"}
    
    return {
        "success": True,
        "data": {
            "code": code,
            "name": quote.get("name", code),
            "valuation": {
                "pe": quote.get("pe", 0),
                "pb": quote.get("pb", 0),
                "marketCap": quote.get("marketCap", 0),
                "marketCapFloat": quote.get("marketCapFloat", 0),
            },
            "price": {
                "current": quote.get("price", 0),
                "preClose": quote.get("preClose", 0),
                "changePct": round((quote.get("price", 0) - quote.get("preClose", 1)) / quote.get("preClose", 1) * 100, 2) if quote.get("preClose") else 0,
            },
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
