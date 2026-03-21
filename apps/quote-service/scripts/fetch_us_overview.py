#!/usr/bin/env python3
"""
美股盘后数据采集 (使用新浪财经接口)
- 涨跌家数
- 成交额
- 涨跌幅榜
- 中概股表现
"""

import httpx
import json
import re
from datetime import datetime

# 新浪美股 API
SINA_US_API = "https://stock.finance.sina.com.cn/usstock/api/jsonp.php"
HEADERS = {"Referer": "http://finance.sina.com.cn"}

def parse_jsonp(text):
    """解析 JSONP 响应"""
    match = re.search(r'=\((.*)\);?$', text)
    if match:
        return json.loads(match.group(1))
    return None

def fetch_us_stocks_page(page=1, num=100, sort="volume", asc=0):
    """获取美股列表"""
    url = f"{SINA_US_API}/var%20_USLIST=/US_CategoryService.getList"
    params = {
        "page": page,
        "num": num,
        "sort": sort,
        "asc": asc,
        "market": "",
        "type": ""
    }
    
    try:
        resp = httpx.get(url, params=params, headers=HEADERS, timeout=20)
        data = parse_jsonp(resp.text)
        if data:
            return data.get("data", []), int(data.get("count", 0))
        return [], 0
    except Exception as e:
        print(f"Error fetching US stocks: {e}")
        return [], 0

def fetch_all_us_stocks():
    """获取美股全部数据 (采样)"""
    # 获取总数
    _, total = fetch_us_stocks_page(page=1, num=1)
    print(f"Total US stocks: {total}")
    
    # 分页获取 (限制请求数)
    all_stocks = []
    page = 1
    max_pages = 50  # 限制
    
    while page <= max_pages:
        stocks, _ = fetch_us_stocks_page(page=page, num=200)
        if not stocks:
            break
        all_stocks.extend(stocks)
        page += 1
    
    print(f"Fetched {len(all_stocks)} stocks")
    return all_stocks

def analyze_us_market():
    """分析美股市场数据"""
    stocks = fetch_all_us_stocks()
    
    if not stocks:
        return None
    
    up_count = 0
    down_count = 0
    flat_count = 0
    total_volume = 0
    
    buckets = {
        "up_limit": 0,
        "up_big": 0,
        "up_medium": 0,
        "up_small": 0,
        "flat": 0,
        "down_small": 0,
        "down_medium": 0,
        "down_big": 0,
        "down_limit": 0
    }
    
    for stock in stocks:
        try:
            pct = float(stock.get("chg", 0))
            vol = int(stock.get("volume", 0)) if stock.get("volume") else 0
            total_volume += vol
        except:
            continue
        
        if pct > 0:
            up_count += 1
            if pct > 10:
                buckets["up_limit"] += 1
            elif pct > 5:
                buckets["up_big"] += 1
            elif pct > 2:
                buckets["up_medium"] += 1
            else:
                buckets["up_small"] += 1
        elif pct < 0:
            down_count += 1
            if pct < -10:
                buckets["down_limit"] += 1
            elif pct < -5:
                buckets["down_big"] += 1
            elif pct < -2:
                buckets["down_medium"] += 1
            else:
                buckets["down_small"] += 1
        else:
            flat_count += 1
            buckets["flat"] += 1
    
    total = up_count + down_count + flat_count
    sentiment_index = (up_count / total * 100) if total > 0 else 50
    
    if sentiment_index >= 70:
        sentiment_label = "强势"
    elif sentiment_index >= 55:
        sentiment_label = "偏强"
    elif sentiment_index >= 45:
        sentiment_label = "中性"
    elif sentiment_index >= 30:
        sentiment_label = "偏弱"
    else:
        sentiment_label = "弱势"
    
    return {
        "market": "US",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "time": datetime.now().strftime("%H:%M:%S"),
        "stats": {
            "total": total,
            "up_count": up_count,
            "down_count": down_count,
            "flat_count": flat_count,
            "total_volume": total_volume
        },
        "buckets": [
            {"name": "涨>10%", "count": buckets["up_limit"], "dir": "up"},
            {"name": "涨5-10%", "count": buckets["up_big"], "dir": "up"},
            {"name": "涨2-5%", "count": buckets["up_medium"], "dir": "up"},
            {"name": "涨0-2%", "count": buckets["up_small"], "dir": "up"},
            {"name": "平盘", "count": buckets["flat"], "dir": "flat"},
            {"name": "跌0-2%", "count": buckets["down_small"], "dir": "down"},
            {"name": "跌2-5%", "count": buckets["down_medium"], "dir": "down"},
            {"name": "跌5-10%", "count": buckets["down_big"], "dir": "down"},
            {"name": "跌>10%", "count": buckets["down_limit"], "dir": "down"},
        ],
        "sentiment": {
            "index": round(sentiment_index, 1),
            "label": sentiment_label
        }
    }

def fetch_us_top_movers():
    """获取美股涨跌幅榜"""
    gainers = []
    losers = []
    
    # 涨幅榜
    try:
        url = f"{SINA_US_API}/var%20_USGAINERS=/US_CategoryService.getList"
        params = {"page": 1, "num": 10, "sort": "chg", "asc": 0}
        resp = httpx.get(url, params=params, headers=HEADERS, timeout=10)
        data = parse_jsonp(resp.text)
        
        if data and data.get("data"):
            for s in data["data"][:10]:
                gainers.append({
                    "code": f"US{s['symbol']}",
                    "name": s.get("cname") or s.get("name", ""),
                    "price": float(s.get("price", 0)),
                    "change_pct": float(s.get("chg", 0)),
                    "volume": int(s.get("volume", 0)) if s.get("volume") else 0
                })
    except Exception as e:
        print(f"Error fetching US gainers: {e}")
    
    # 跌幅榜
    try:
        url = f"{SINA_US_API}/var%20_USLOSERS=/US_CategoryService.getList"
        params = {"page": 1, "num": 10, "sort": "chg", "asc": 1}
        resp = httpx.get(url, params=params, headers=HEADERS, timeout=10)
        data = parse_jsonp(resp.text)
        
        if data and data.get("data"):
            for s in data["data"][:10]:
                losers.append({
                    "code": f"US{s['symbol']}",
                    "name": s.get("cname") or s.get("name", ""),
                    "price": float(s.get("price", 0)),
                    "change_pct": float(s.get("chg", 0)),
                    "volume": int(s.get("volume", 0)) if s.get("volume") else 0
                })
    except Exception as e:
        print(f"Error fetching US losers: {e}")
    
    return {
        "gainers": gainers,
        "losers": losers
    }

def fetch_china_concept_stocks():
    """获取中概股表现"""
    stocks = []
    
    # 中概股热门代码
    china_stocks = [
        "BABA", "JD", "PDD", "BIDU", "NIO", "XPEV", "LI", "BILI", 
        "TME", "IQ", "EDU", "TAL", "NTES", "TCOM", "VNET", "HTHT",
        "ZTO", "MNSO", "KC", "FUTU"
    ]
    
    try:
        # 获取实时行情
        codes = ",".join(china_stocks)
        url = f"http://hq.sinajs.cn/list={','.join(['gb_' + c.lower() for c in china_stocks])}"
        resp = httpx.get(url, headers={"Referer": "http://finance.sina.com.cn"}, timeout=10)
        
        pattern = r'var hq_str_gb_(\w+)="([^"]+)";'
        matches = re.findall(pattern, resp.text)
        
        for symbol, data_str in matches:
            if not data_str:
                continue
            parts = data_str.split(",")
            if len(parts) >= 5:
                try:
                    stocks.append({
                        "code": f"US{symbol.upper()}",
                        "name": parts[0],
                        "price": float(parts[1]) if parts[1] else 0,
                        "change_pct": float(parts[2]) if parts[2] else 0,
                        "volume": int(float(parts[10])) if len(parts) > 10 and parts[10] else 0
                    })
                except:
                    pass
    except Exception as e:
        print(f"Error fetching China concept stocks: {e}")
    
    return stocks

def save_snapshot(data, filename):
    """保存快照到文件"""
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cache_dir = os.path.join(script_dir, "..", "cache")
    os.makedirs(cache_dir, exist_ok=True)
    
    filepath = os.path.join(cache_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Saved to {filepath}")

if __name__ == "__main__":
    print("=== 美股盘后数据采集 ===\n")
    
    # 市场概况
    overview = analyze_us_market()
    if overview:
        print(f"日期: {overview['date']}")
        print(f"采样股票数: {overview['stats']['total']}")
        print(f"上涨: {overview['stats']['up_count']} | 下跌: {overview['stats']['down_count']} | 平盘: {overview['stats']['flat_count']}")
        print(f"赚钱效应: {overview['sentiment']['index']}% ({overview['sentiment']['label']})")
        print("\n涨跌分布:")
        for b in overview['buckets']:
            print(f"  {b['name']}: {b['count']}")
    
    # 涨跌幅榜
    print("\n=== 涨跌幅榜 ===")
    movers = fetch_us_top_movers()
    
    print("\n📈 涨幅榜:")
    for s in movers['gainers'][:5]:
        print(f"  {s['name']} ({s['code']}): +{s['change_pct']:.2f}%")
    
    print("\n📉 跌幅榜:")
    for s in movers['losers'][:5]:
        print(f"  {s['name']} ({s['code']}): {s['change_pct']:.2f}%")
    
    # 中概股
    print("\n=== 中概股表现 ===")
    china_stocks = fetch_china_concept_stocks()
    for s in china_stocks[:10]:
        sign = "+" if s['change_pct'] > 0 else ""
        print(f"  {s['name']} ({s['code']}): {sign}{s['change_pct']:.2f}%")
    
    # 保存结果
    result = {
        "overview": overview,
        "movers": movers,
        "china_concept": china_stocks,
        "fetched_at": datetime.now().isoformat()
    }
    
    save_snapshot(result, "us_overview.json")
    
    print("\n\n=== JSON 输出 ===")
    print(json.dumps(result, ensure_ascii=False, indent=2))
