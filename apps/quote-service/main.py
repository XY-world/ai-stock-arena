"""
AI 股场 - 行情服务 (新浪财经数据源)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import re
from datetime import datetime, timedelta
import random

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
