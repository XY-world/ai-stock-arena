"""
AI 股场 - 行情服务 (新浪财经数据源)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import re
import json
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
    """SH600519 -> sh600519, HK00700 -> rt_hk00700, AAPL -> gb_aapl"""
    code = code.upper()
    if code.startswith("HK"):
        return f"rt_hk{code[2:]}"
    if code.startswith("SH") or code.startswith("SZ"):
        return code.lower()
    # 美股
    return f"gb_{code.lower()}"

def from_sina_code(code: str) -> str:
    """sh600519 -> SH600519, rt_hk00700 -> HK00700, gb_aapl -> AAPL"""
    if code.startswith("rt_hk"):
        return f"HK{code[5:]}"
    if code.startswith("gb_"):
        return code[3:].upper()
    return code.upper()

def get_market(code: str) -> str:
    """获取市场类型: CN, HK, US"""
    code = code.upper()
    if code.startswith("HK"):
        return "HK"
    if code.startswith("SH") or code.startswith("SZ"):
        return "CN"
    return "US"

# 热门股票列表 (A股)
HOT_STOCKS_CN = [
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

# 热门股票列表 (港股)
HOT_STOCKS_HK = [
    "HK00700",   # 腾讯控股
    "HK09988",   # 阿里巴巴
    "HK03690",   # 美团
    "HK09618",   # 京东集团
    "HK00941",   # 中国移动
    "HK01810",   # 小米集团
    "HK09888",   # 百度集团
    "HK02318",   # 中国平安
    "HK00388",   # 香港交易所
    "HK00005",   # 汇丰控股
    "HK01299",   # 友邦保险
    "HK02020",   # 安踏体育
    "HK09999",   # 网易
    "HK00175",   # 吉利汽车
    "HK02382",   # 舜宇光学
    "HK01211",   # 比亚迪股份
    "HK00027",   # 银河娱乐
    "HK00883",   # 中国海洋石油
    "HK03968",   # 招商银行
    "HK01024",   # 快手
]

# 美股热门
HOT_STOCKS_US = [
    "AAPL",    # 苹果
    "MSFT",    # 微软
    "GOOGL",   # 谷歌
    "AMZN",    # 亚马逊
    "NVDA",    # 英伟达
    "META",    # Meta
    "TSLA",    # 特斯拉
    "BRK.B",   # 伯克希尔B
    "JPM",     # 摩根大通
    "V",       # Visa
    "UNH",     # 联合健康
    "MA",      # 万事达
    "HD",      # 家得宝
    "PG",      # 宝洁
    "JNJ",     # 强生
    "COST",    # 好市多
    "ABBV",    # 艾伯维
    "CRM",     # Salesforce
    "AMD",     # AMD
    "NFLX",    # 奈飞
]

# 美股中文名映射
HOT_STOCKS_US_NAMES = {
    "AAPL": "苹果",
    "MSFT": "微软",
    "GOOGL": "谷歌",
    "AMZN": "亚马逊",
    "NVDA": "英伟达",
    "META": "Meta",
    "TSLA": "特斯拉",
    "BRK.B": "伯克希尔B",
    "JPM": "摩根大通",
    "V": "Visa",
    "UNH": "联合健康",
    "MA": "万事达",
    "HD": "家得宝",
    "PG": "宝洁",
    "JNJ": "强生",
    "COST": "好市多",
    "ABBV": "艾伯维",
    "CRM": "Salesforce",
    "AMD": "AMD",
    "NFLX": "奈飞",
}

# 合并的热门股票
HOT_STOCKS = HOT_STOCKS_CN

# 指数代码
INDEX_CODES = {
    "上证指数": "sh000001",
    "深证成指": "sz399001",
    "创业板指": "sz399006",
    "科创50": "sh000688",
}

# 港股指数
INDEX_CODES_HK = {
    "恒生指数": "rt_hkHSI",
    "恒生科技": "rt_hkHSTECH",
    "国企指数": "rt_hkHSCEI",
}

# 美股指数
INDEX_CODES_US = {
    "道琼斯": "gb_$dji",
    "标普500": "gb_$inx",
    "纳斯达克": "gb_$ixic",
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
    
    # 匹配 var hq_str_sh600519="..."; 或 var hq_str_rt_hk00700="...";
    pattern = r'var hq_str_([\w$]+)="([^"]+)";'
    matches = re.findall(pattern, text)
    
    for sina_code, data_str in matches:
        if not data_str:
            continue
        
        code = from_sina_code(sina_code)
        market = get_market(code)
        parts = data_str.split(",")
        
        try:
            if market == "HK":
                # 港股数据格式
                if len(parts) < 15:
                    continue
                result[code] = {
                    "code": code,
                    "market": "HK",
                    "currency": "HKD",
                    "name": parts[1],
                    "nameEn": parts[0],
                    "open": safe_float(parts[3]),
                    "preClose": safe_float(parts[2]),
                    "price": safe_float(parts[6]),
                    "high": safe_float(parts[4]),
                    "low": safe_float(parts[5]),
                    "volume": safe_int(parts[11]),
                    "amount": safe_float(parts[10]),
                    "date": parts[15] if len(parts) > 15 else "",
                    "time": parts[16] if len(parts) > 16 else "",
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
            else:
                # 检查是否是美股
                if sina_code.startswith("gb_"):
                    # 美股数据格式: 名称,当前价,涨跌额,时间,涨跌幅,开盘,最高,最低,52周最高,52周最低,成交量,10日均量,市值,市盈率,EPS,...,收盘价
                    if len(parts) < 20:
                        continue
                    result[code] = {
                        "code": code,
                        "market": "US",
                        "currency": "USD",
                        "name": HOT_STOCKS_US_NAMES.get(code, parts[0]),  # 使用预定义中文名
                        "open": safe_float(parts[5]),
                        "preClose": safe_float(parts[26]) if len(parts) > 26 else safe_float(parts[5]),
                        "price": safe_float(parts[1]),
                        "high": safe_float(parts[6]),
                        "low": safe_float(parts[7]),
                        "volume": safe_int(parts[10]),
                        "amount": 0,  # 美股没有金额字段
                        "date": parts[3].split(" ")[0] if parts[3] else "",
                        "time": parts[3].split(" ")[1] if " " in parts[3] else "",
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
                else:
                    # A股数据格式
                    if len(parts) < 32:
                        continue
                    result[code] = {
                        "code": code,
                        "market": "CN",
                        "currency": "CNY",
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
async def get_hot_stocks(market: str = "CN"):
    """获取热门股票
    
    - market: CN (A股) | HK (港股) | US (美股) | ALL (全部)
    """
    market = market.upper()
    
    if market == "HK":
        stocks = HOT_STOCKS_HK
    elif market == "US":
        stocks = HOT_STOCKS_US
    elif market == "ALL":
        stocks = HOT_STOCKS_CN + HOT_STOCKS_HK + HOT_STOCKS_US
    else:
        stocks = HOT_STOCKS_CN
    
    quotes = await fetch_sina_quotes(stocks)
    
    # 按涨跌幅排序
    result = sorted(
        [quotes[c] for c in stocks if c in quotes],
        key=lambda x: x.get("changePct", 0),
        reverse=True
    )
    
    return {"success": True, "data": result, "market": market}


@app.get("/v1/market/overview")
async def get_market_overview(market: str = "CN"):
    """获取市场概况
    
    - market: CN (A股) | HK (港股) | US (美股)
    """
    market = market.upper()
    
    # 选择指数
    if market == "HK":
        index_codes = INDEX_CODES_HK
    elif market == "US":
        index_codes = INDEX_CODES_US
    else:
        index_codes = INDEX_CODES
    
    # 获取指数数据
    index_codes_list = list(index_codes.values())
    url = SINA_API + ",".join(index_codes_list)
    
    indices = {}
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url, headers=SINA_HEADERS)
            pattern = r'var hq_str_([\w$]+)="([^"]+)";'
            matches = re.findall(pattern, resp.text)
            
            for sina_code, data_str in matches:
                if not data_str:
                    continue
                parts = data_str.split(",")
                if len(parts) < 4:
                    continue
                
                # 找到对应的中文名
                for name, code in index_codes.items():
                    if code == sina_code:
                        if market == "HK":
                            # 港股指数格式不同
                            price = safe_float(parts[6]) if len(parts) > 6 else safe_float(parts[0])
                            pre_close = safe_float(parts[3]) if len(parts) > 3 else price
                        elif market == "US":
                            # 美股指数格式: 名称,当前价,涨跌额,涨跌幅,昨收,开盘,...
                            price = safe_float(parts[1]) if len(parts) > 1 else 0
                            pre_close = safe_float(parts[26]) if len(parts) > 26 else price
                        else:
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
    
    # 涨跌家数
    if market == "HK":
        # 港股使用缓存数据
        hk_data = get_global_market_data("hk", ttl=1800)
        if hk_data and hk_data.get("overview"):
            stats = hk_data["overview"].get("stats", {})
            up_count = stats.get("up_count", 0)
            down_count = stats.get("down_count", 0)
            flat_count = stats.get("flat_count", 0)
            total_amount = stats.get("total_amount", 0)
            buckets_data = hk_data["overview"].get("buckets", [])
        else:
            up_count = 0
            down_count = 0
            flat_count = 0
            total_amount = 0
            buckets_data = []
    elif market == "US":
        # 美股使用缓存数据
        us_data = get_global_market_data("us", ttl=1800)
        if us_data and us_data.get("overview"):
            stats = us_data["overview"].get("stats", {})
            up_count = stats.get("up_count", 0)
            down_count = stats.get("down_count", 0)
            flat_count = stats.get("flat_count", 0)
            total_amount = 0  # 美股暂无成交额
            buckets_data = us_data["overview"].get("buckets", [])
        else:
            up_count = 0
            down_count = 0
            flat_count = 0
            total_amount = 0
            buckets_data = []
    else:
        # A股使用恢恢量化数据
        hhxg_data = get_hhxg_cached("snapshot", "fetch_snapshot.py", ttl=3600)
        market_data = hhxg_data.get("market", {}) if hhxg_data else {}
        buckets = market_data.get("buckets", [])
        
        up_count = sum(b.get("count", 0) for b in buckets if b.get("dir") == "up" or "涨" in b.get("name", ""))
        down_count = sum(b.get("count", 0) for b in buckets if b.get("dir") == "down" or "跌" in b.get("name", ""))
        total = market_data.get("total", 0)
        flat_count = total - up_count - down_count if total else 0
        buckets_data = buckets
        total_amount = market_data.get("total_amount", 0)
    
    # 构建响应
    response_data = {
        "indices": indices,
        "upCount": up_count,
        "downCount": down_count,
        "flatCount": flat_count,
        "timestamp": datetime.now().isoformat(),
    }
    
    # 港股/美股添加更多数据
    if market in ("HK", "US") and buckets_data:
        response_data["buckets"] = buckets_data
        if total_amount:
            response_data["totalAmount"] = total_amount
            response_data["totalAmountFormatted"] = f"{total_amount/100000000:.2f}亿"
    
    return {
        "success": True,
        "data": response_data,
        "market": market,
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
    """从腾讯获取行情数据 (包含 PE/PB) - 仅支持 A股"""
    market = get_market(code)
    if market != "CN":
        return {}  # 腾讯 API 只支持 A股
    
    tencent_code = to_sina_code(code)
    
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


async def fetch_hk_fundamental(code: str) -> dict:
    """从新浪获取港股估值数据"""
    sina_code = to_sina_code(code)  # rt_hkXXXXX
    url = SINA_API + sina_code
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url, headers=SINA_HEADERS)
            # 格式: var hq_str_rt_hkXXXXX="TENCENT,腾讯控股,505.000,513.000,519.000,505.000,508.000,-5.000,-0.975,508.000,508.500,12743703970.890,24924662,18.481,0.000,683.000,415.374,..."
            match = re.search(r'var hq_str_[\w]+="([^"]+)"', resp.text)
            if not match:
                return {}
            
            parts = match.group(1).split(",")
            if len(parts) < 17:
                return {}
            
            # 港股数据字段:
            # 0: 英文名, 1: 中文名, 2: 昨收, 3: 开盘, 4: 最高, 5: 最低, 6: 最新价
            # 7: 涨跌额, 8: 涨跌幅, 9: 买入, 10: 卖出, 11: 成交额, 12: 成交量
            # 13: 市盈率, 14: 52周最高, 15: 52周最低, 16: 市值(亿港元)
            return {
                "code": code,
                "name": parts[1],
                "price": safe_float(parts[6]),
                "preClose": safe_float(parts[2]),
                "pe": safe_float(parts[13]) if len(parts) > 13 else 0,
                "high52w": safe_float(parts[14]) if len(parts) > 14 else 0,
                "low52w": safe_float(parts[15]) if len(parts) > 15 else 0,
                "marketCap": safe_float(parts[16]) if len(parts) > 16 else 0,
            }
        except Exception as e:
            print(f"HK fundamental error: {e}")
            return {}


async def fetch_us_fundamental(code: str) -> dict:
    """从新浪获取美股估值数据"""
    sina_code = to_sina_code(code)  # gb_xxxx
    url = SINA_API + sina_code
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url, headers=SINA_HEADERS)
            match = re.search(r'var hq_str_[\w$]+="([^"]+)"', resp.text)
            if not match:
                return {}
            
            parts = match.group(1).split(",")
            if len(parts) < 20:
                return {}
            
            # 美股数据字段:
            # 0: 名称, 1: 当前价, 2: 涨跌额, 3: 时间, 4: 涨跌幅
            # 5: 开盘, 6: 最高, 7: 最低, 8: 52周最高, 9: 52周最低
            # 10: 成交量, 11: 10日均量, 12: 市值, 13: 市盈率, 14: EPS
            # 15: Beta, 16: 股息, 17: 股息率, 18: 总股本, 19: 股东权益
            return {
                "code": code,
                "name": HOT_STOCKS_US_NAMES.get(code, parts[0]),
                "price": safe_float(parts[1]),
                "preClose": safe_float(parts[26]) if len(parts) > 26 else 0,
                "pe": safe_float(parts[13]) if len(parts) > 13 else 0,
                "eps": safe_float(parts[14]) if len(parts) > 14 else 0,
                "high52w": safe_float(parts[8]) if len(parts) > 8 else 0,
                "low52w": safe_float(parts[9]) if len(parts) > 9 else 0,
                "marketCap": safe_float(parts[12]) if len(parts) > 12 else 0,
                "dividend": safe_float(parts[16]) if len(parts) > 16 else 0,
                "dividendYield": safe_float(parts[17]) if len(parts) > 17 else 0,
            }
        except Exception as e:
            print(f"US fundamental error: {e}")
            return {}


@app.get("/v1/market/fundamental/{code}")
async def get_fundamental(code: str):
    """获取基本面/估值数据
    
    返回: PE, PB, 市值等估值指标
    """
    code = code.upper()
    market = get_market(code)
    
    quote = None
    
    if market == "HK":
        quote = await fetch_hk_fundamental(code)
        if quote:
            return {
                "success": True,
                "data": {
                    "code": code,
                    "name": quote.get("name", code),
                    "market": "HK",
                    "valuation": {
                        "pe": quote.get("pe", 0),
                        "pb": 0,  # 港股暂无 PB 数据
                        "marketCap": quote.get("marketCap", 0),
                        "marketCapFloat": 0,
                        "high52w": quote.get("high52w", 0),
                        "low52w": quote.get("low52w", 0),
                    },
                    "price": {
                        "current": quote.get("price", 0),
                        "preClose": quote.get("preClose", 0),
                        "changePct": round((quote.get("price", 0) - quote.get("preClose", 1)) / quote.get("preClose", 1) * 100, 2) if quote.get("preClose") else 0,
                    },
                }
            }
    elif market == "US":
        quote = await fetch_us_fundamental(code)
        if quote:
            return {
                "success": True,
                "data": {
                    "code": code,
                    "name": quote.get("name", code),
                    "market": "US",
                    "valuation": {
                        "pe": quote.get("pe", 0),
                        "pb": 0,  # 美股暂无 PB 数据
                        "marketCap": quote.get("marketCap", 0),
                        "marketCapFloat": 0,
                        "eps": quote.get("eps", 0),
                        "high52w": quote.get("high52w", 0),
                        "low52w": quote.get("low52w", 0),
                        "dividend": quote.get("dividend", 0),
                        "dividendYield": quote.get("dividendYield", 0),
                    },
                    "price": {
                        "current": quote.get("price", 0),
                        "preClose": quote.get("preClose", 0),
                        "changePct": round((quote.get("price", 0) - quote.get("preClose", 1)) / quote.get("preClose", 1) * 100, 2) if quote.get("preClose") else 0,
                    },
                }
            }
    else:
        # A股从腾讯获取
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
            "market": "CN",
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


# ========== 灰灰量化数据 (hhxg.top) ==========

import subprocess
import os

HHXG_DIR = os.path.join(os.path.dirname(__file__), "hhxg")

def run_hhxg_script(script: str, args: list = None) -> dict:
    """运行灰灰量化脚本并返回 JSON"""
    cmd = ["python3", os.path.join(HHXG_DIR, script), "--json"]
    if args:
        cmd.extend(args)
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        output = result.stdout
        
        # 跳过 NOTE 行，找到 JSON
        lines = output.strip().split('\n')
        json_start = 0
        for i, line in enumerate(lines):
            if line.strip().startswith('{'):
                json_start = i
                break
        
        json_text = '\n'.join(lines[json_start:])
        return json.loads(json_text)
    except Exception as e:
        print(f"HHXG script error: {e}")
        return None


# 缓存
_hhxg_cache = {}
_hhxg_cache_time = {}
_global_cache = {}
_global_cache_time = {}

def get_hhxg_cached(key: str, script: str, args: list = None, ttl: int = 3600) -> dict:
    """带缓存的灰灰数据获取"""
    now = datetime.now()
    
    if key in _hhxg_cache and key in _hhxg_cache_time:
        if (now - _hhxg_cache_time[key]).seconds < ttl:
            return _hhxg_cache[key]
    
    data = run_hhxg_script(script, args)
    if data:
        _hhxg_cache[key] = data
        _hhxg_cache_time[key] = now
    
    return data


def get_global_market_data(market: str, ttl: int = 1800) -> dict:
    """获取港股/美股的缓存数据
    
    缓存文件由 scripts/fetch_hk_overview.py 和 fetch_us_overview.py 生成
    """
    import os
    
    now = datetime.now()
    cache_key = f"global_{market}"
    
    # 检查内存缓存
    if cache_key in _global_cache and cache_key in _global_cache_time:
        if (now - _global_cache_time[cache_key]).seconds < ttl:
            return _global_cache[cache_key]
    
    # 从文件读取
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cache_file = os.path.join(script_dir, "cache", f"{market.lower()}_overview.json")
    
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                _global_cache[cache_key] = data
                _global_cache_time[cache_key] = now
                return data
        except Exception as e:
            print(f"Error reading {cache_file}: {e}")
    
    return None


@app.get("/v1/market/sentiment")
async def get_sentiment(market: str = "CN"):
    """获取市场情绪
    
    - market: CN (A股) | HK (港股) | US (美股)
    
    返回: 赚钱效应、涨跌家数、涨停数、炸板率等
    """
    market = market.upper()
    
    if market == "HK":
        # 港股情绪数据
        hk_data = get_global_market_data("hk", ttl=1800)
        if not hk_data or not hk_data.get("overview"):
            return {"success": False, "error": "No HK market data available"}
        
        overview = hk_data["overview"]
        stats = overview.get("stats", {})
        sentiment = overview.get("sentiment", {})
        
        return {
            "success": True,
            "data": {
                "market": "HK",
                "date": overview.get("date", ""),
                "sentiment": {
                    "index": sentiment.get("index", 50),
                    "label": sentiment.get("label", "中性"),
                    "upCount": stats.get("up_count", 0),
                    "downCount": stats.get("down_count", 0),
                    "flatCount": stats.get("flat_count", 0),
                    "total": stats.get("total_traded", 0),
                },
                "buckets": overview.get("buckets", []),
                "totalAmount": stats.get("total_amount", 0),
                "totalAmountFormatted": stats.get("total_amount_formatted", ""),
            }
        }
    
    elif market == "US":
        # 美股情绪数据
        us_data = get_global_market_data("us", ttl=1800)
        if not us_data or not us_data.get("overview"):
            return {"success": False, "error": "No US market data available"}
        
        overview = us_data["overview"]
        stats = overview.get("stats", {})
        sentiment = overview.get("sentiment", {})
        
        return {
            "success": True,
            "data": {
                "market": "US",
                "date": overview.get("date", ""),
                "sentiment": {
                    "index": sentiment.get("index", 50),
                    "label": sentiment.get("label", "中性"),
                    "upCount": stats.get("up_count", 0),
                    "downCount": stats.get("down_count", 0),
                    "flatCount": stats.get("flat_count", 0),
                    "total": stats.get("total", 0),
                },
                "buckets": overview.get("buckets", []),
                "chinaConceptStocks": us_data.get("china_concept", []),
            }
        }
    
    else:
        # A股使用原有的恢恢量化数据
        data = get_hhxg_cached("snapshot", "fetch_snapshot.py", ttl=3600)
    
        if not data:
            return {"success": False, "error": "Failed to fetch sentiment data"}
        
        market_data = data.get("market", {})
        ai_summary = data.get("ai_summary", {})
        
        # 解析涨跌家数 - 使用 dir 或 name 字段判断（buckets 没有 pct_min/pct_max）
        buckets = market_data.get("buckets", [])
        up_count = sum(b.get("count", 0) for b in buckets if b.get("dir") == "up" or "涨" in b.get("name", ""))
        down_count = sum(b.get("count", 0) for b in buckets if b.get("dir") == "down" or "跌" in b.get("name", ""))
        flat_count = market_data.get("total", 0) - up_count - down_count
        
        return {
            "success": True,
            "data": {
                "market": "CN",
                "date": data.get("date"),
                "summary": ai_summary.get("market_state", ""),
                "focus": ai_summary.get("focus_direction", ""),
                "sentiment": {
                    "index": market_data.get("sentiment_index", 0),
                    "label": market_data.get("sentiment_label", ""),
                    "upCount": up_count,
                    "downCount": down_count,
                    "flatCount": flat_count,
                    "total": market_data.get("total", 0),
                },
                "buckets": buckets,
                "highlights": {
                    "theme": ai_summary.get("theme_focus", ""),
                    "hotmoney": ai_summary.get("hotmoney_state", ""),
                    "news": ai_summary.get("news_highlight", ""),
                }
            }
        }


@app.get("/v1/market/themes")
async def get_themes():
    """获取热门题材"""
    data = get_hhxg_cached("snapshot", "fetch_snapshot.py", ttl=3600)
    
    if not data:
        return {"success": False, "error": "Failed to fetch themes data"}
    
    hot_themes = data.get("hot_themes", [])
    
    return {
        "success": True,
        "data": {
            "date": data.get("date"),
            "themes": [
                {
                    "name": t.get("name", ""),
                    "limitUpCount": t.get("limitup_count", 0),
                    "netFlow": t.get("net_yi", 0),
                    "topStocks": [s.get("name") for s in t.get("top_stocks", [])[:3]],
                }
                for t in hot_themes[:10]
            ]
        }
    }


@app.get("/v1/market/ladder")
async def get_ladder():
    """获取连板天梯"""
    data = get_hhxg_cached("snapshot", "fetch_snapshot.py", ttl=3600)
    
    if not data:
        return {"success": False, "error": "Failed to fetch ladder data"}
    
    ladder = data.get("ladder", {})
    ladder_detail = data.get("ladder_detail", [])
    
    return {
        "success": True,
        "data": {
            "date": data.get("date"),
            "totalLimitUp": ladder.get("total_limit_up", 0),
            "maxStreak": ladder.get("max_streak", 0),
            "topStreak": ladder.get("top_streak", {}),
            "levels": ladder_detail,
        }
    }


@app.get("/v1/market/hotmoney")
async def get_hotmoney():
    """获取游资龙虎榜"""
    data = get_hhxg_cached("snapshot", "fetch_snapshot.py", ttl=3600)
    
    if not data:
        return {"success": False, "error": "Failed to fetch hotmoney data"}
    
    hotmoney = data.get("hotmoney", {})
    
    return {
        "success": True,
        "data": {
            "date": data.get("date"),
            "totalNetBuy": hotmoney.get("total_net_yi", 0),
            "topNetBuy": hotmoney.get("top_net_buy", [])[:10],
            "seats": hotmoney.get("seats", [])[:5],
        }
    }


@app.get("/v1/market/sectors")
async def get_sectors():
    """获取行业资金流向"""
    data = get_hhxg_cached("snapshot", "fetch_snapshot.py", ttl=3600)
    
    if not data:
        return {"success": False, "error": "Failed to fetch sectors data"}
    
    sectors = data.get("sectors", [])
    
    # 找到行业分类
    industry = next((s for s in sectors if s.get("label") == "行业"), {})
    concept = next((s for s in sectors if s.get("label") == "板块"), {})
    
    return {
        "success": True,
        "data": {
            "date": data.get("date"),
            "industry": {
                "inflow": industry.get("strong", [])[:5],
                "outflow": industry.get("weak", [])[:5],
            },
            "concept": {
                "inflow": concept.get("strong", [])[:5],
                "outflow": concept.get("weak", [])[:5],
            },
        }
    }


@app.get("/v1/market/margin")
async def get_margin():
    """获取融资融券数据"""
    data = get_hhxg_cached("margin", "margin.py", ttl=3600)
    
    if not data:
        return {"success": False, "error": "Failed to fetch margin data"}
    
    return {
        "success": True,
        "data": data
    }


@app.get("/v1/market/calendar")
async def get_calendar(date: str = None):
    """获取 A 股日历"""
    args = []
    if date:
        args = ["trading", date]
    
    data = get_hhxg_cached(f"calendar_{date or 'week'}", "stock_calendar.py", args, ttl=86400)
    
    if not data:
        return {"success": False, "error": "Failed to fetch calendar data"}
    
    return {
        "success": True,
        "data": data
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
