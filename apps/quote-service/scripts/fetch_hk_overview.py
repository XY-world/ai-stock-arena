#!/usr/bin/env python3
"""
港股盘后数据采集 (使用新浪财经接口)
采用多接口组合方式获取完整数据
"""

import httpx
import json
import re
from datetime import datetime

HEADERS = {"Referer": "http://finance.sina.com.cn"}

# 新浪港股 API
SINA_HK_API = "http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHKStockData"
SINA_HK_COUNT_API = "http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHKStockCount"

def get_hk_stock_count():
    """获取港股总数"""
    try:
        resp = httpx.get(f"{SINA_HK_COUNT_API}?node=qbgg_hk", headers=HEADERS, timeout=10)
        return int(resp.text.strip('"'))
    except:
        return 2500  # 默认值

def fetch_hk_stocks_by_change():
    """通过涨跌幅排序获取所有有交易的股票"""
    all_stocks = []
    
    # 获取涨幅榜（有交易的股票）
    for page in range(1, 20):
        try:
            params = {
                "page": page,
                "num": 80,
                "sort": "changepercent",
                "asc": 0,
                "node": "qbgg_hk"
            }
            resp = httpx.get(SINA_HK_API, params=params, headers=HEADERS, timeout=20)
            data = resp.json()
            
            if not data:
                break
            
            # 过滤已添加的
            new_stocks = []
            existing_symbols = {s['symbol'] for s in all_stocks}
            for s in data:
                if s['symbol'] not in existing_symbols:
                    new_stocks.append(s)
            
            if not new_stocks:
                break
                
            all_stocks.extend(new_stocks)
            print(f"Fetched page {page}: {len(new_stocks)} new stocks, total: {len(all_stocks)}")
            
        except Exception as e:
            print(f"Error page {page}: {e}")
            break
    
    # 获取跌幅榜（升序排列）
    for page in range(1, 20):
        try:
            params = {
                "page": page,
                "num": 80,
                "sort": "changepercent",
                "asc": 1,
                "node": "qbgg_hk"
            }
            resp = httpx.get(SINA_HK_API, params=params, headers=HEADERS, timeout=20)
            data = resp.json()
            
            if not data:
                break
            
            new_stocks = []
            existing_symbols = {s['symbol'] for s in all_stocks}
            for s in data:
                if s['symbol'] not in existing_symbols:
                    new_stocks.append(s)
            
            if not new_stocks:
                break
                
            all_stocks.extend(new_stocks)
            print(f"Fetched losers page {page}: {len(new_stocks)} new stocks, total: {len(all_stocks)}")
            
        except Exception as e:
            print(f"Error losers page {page}: {e}")
            break
    
    # 获取成交额排序（补充中间的股票）
    for page in range(1, 20):
        try:
            params = {
                "page": page,
                "num": 80,
                "sort": "amount",
                "asc": 0,
                "node": "qbgg_hk"
            }
            resp = httpx.get(SINA_HK_API, params=params, headers=HEADERS, timeout=20)
            data = resp.json()
            
            if not data:
                break
            
            new_stocks = []
            existing_symbols = {s['symbol'] for s in all_stocks}
            for s in data:
                if s['symbol'] not in existing_symbols:
                    new_stocks.append(s)
            
            if not new_stocks:
                break
                
            all_stocks.extend(new_stocks)
            print(f"Fetched by volume page {page}: {len(new_stocks)} new stocks, total: {len(all_stocks)}")
            
        except Exception as e:
            print(f"Error volume page {page}: {e}")
            break
    
    return all_stocks

def analyze_hk_market():
    """分析港股市场数据"""
    stocks = fetch_hk_stocks_by_change()
    total_count = get_hk_stock_count()
    
    if not stocks:
        return None
    
    up_count = 0
    down_count = 0
    flat_count = 0
    total_amount = 0
    
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
            pct = float(stock.get("changepercent", 0))
            amount = float(stock.get("amount", 0))
            volume = float(stock.get("volume", 0))
            
            # 只统计有成交的
            if volume == 0:
                continue
                
            total_amount += amount
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
    
    total_traded = up_count + down_count + flat_count
    sentiment_index = (up_count / total_traded * 100) if total_traded > 0 else 50
    
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
        "market": "HK",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "time": datetime.now().strftime("%H:%M:%S"),
        "stats": {
            "total_listed": total_count,
            "total_traded": total_traded,
            "up_count": up_count,
            "down_count": down_count,
            "flat_count": flat_count,
            "total_amount": total_amount,
            "total_amount_hkd": total_amount,
            "total_amount_formatted": f"{total_amount/100000000:.2f}亿"
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

def fetch_hk_top_movers():
    """获取港股涨跌幅榜"""
    gainers = []
    losers = []
    
    # 涨幅榜
    try:
        params = {"page": 1, "num": 10, "sort": "changepercent", "asc": 0, "node": "qbgg_hk"}
        resp = httpx.get(SINA_HK_API, params=params, headers=HEADERS, timeout=10)
        data = resp.json()
        
        for s in data[:10]:
            gainers.append({
                "code": f"HK{s['symbol']}",
                "name": s["name"],
                "price": float(s.get("lasttrade", 0)),
                "change_pct": float(s.get("changepercent", 0)),
                "amount": float(s.get("amount", 0))
            })
    except Exception as e:
        print(f"Error fetching HK gainers: {e}")
    
    # 跌幅榜
    try:
        params = {"page": 1, "num": 10, "sort": "changepercent", "asc": 1, "node": "qbgg_hk"}
        resp = httpx.get(SINA_HK_API, params=params, headers=HEADERS, timeout=10)
        data = resp.json()
        
        for s in data[:10]:
            losers.append({
                "code": f"HK{s['symbol']}",
                "name": s["name"],
                "price": float(s.get("lasttrade", 0)),
                "change_pct": float(s.get("changepercent", 0)),
                "amount": float(s.get("amount", 0))
            })
    except Exception as e:
        print(f"Error fetching HK losers: {e}")
    
    return {"gainers": gainers, "losers": losers}

def fetch_hk_hot_stocks():
    """获取成交额最大的股票"""
    hot = []
    
    try:
        params = {"page": 1, "num": 20, "sort": "amount", "asc": 0, "node": "qbgg_hk"}
        resp = httpx.get(SINA_HK_API, params=params, headers=HEADERS, timeout=10)
        data = resp.json()
        
        for s in data[:20]:
            hot.append({
                "code": f"HK{s['symbol']}",
                "name": s["name"],
                "price": float(s.get("lasttrade", 0)),
                "change_pct": float(s.get("changepercent", 0)),
                "amount": float(s.get("amount", 0)),
                "amount_formatted": f"{float(s.get('amount', 0))/100000000:.2f}亿"
            })
    except Exception as e:
        print(f"Error fetching HK hot stocks: {e}")
    
    return hot

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
    print("=== 港股盘后数据采集 ===\n")
    
    # 市场概况
    overview = analyze_hk_market()
    if overview:
        print(f"\n日期: {overview['date']}")
        print(f"上市股票数: {overview['stats']['total_listed']}")
        print(f"有交易股票数: {overview['stats']['total_traded']}")
        print(f"上涨: {overview['stats']['up_count']} | 下跌: {overview['stats']['down_count']} | 平盘: {overview['stats']['flat_count']}")
        print(f"成交额: {overview['stats']['total_amount_formatted']}")
        print(f"赚钱效应: {overview['sentiment']['index']}% ({overview['sentiment']['label']})")
        print("\n涨跌分布:")
        for b in overview['buckets']:
            print(f"  {b['name']}: {b['count']}")
    
    # 涨跌幅榜
    print("\n=== 涨跌幅榜 ===")
    movers = fetch_hk_top_movers()
    
    print("\n📈 涨幅榜:")
    for s in movers['gainers'][:5]:
        print(f"  {s['name']} ({s['code']}): +{s['change_pct']:.2f}%")
    
    print("\n📉 跌幅榜:")
    for s in movers['losers'][:5]:
        print(f"  {s['name']} ({s['code']}): {s['change_pct']:.2f}%")
    
    # 热门股
    print("\n=== 成交额榜 ===")
    hot = fetch_hk_hot_stocks()
    for s in hot[:5]:
        sign = "+" if s['change_pct'] > 0 else ""
        print(f"  {s['name']}: {sign}{s['change_pct']:.2f}% ({s['amount_formatted']})")
    
    # 保存结果
    result = {
        "overview": overview,
        "movers": movers,
        "hot_stocks": hot,
        "fetched_at": datetime.now().isoformat()
    }
    
    save_snapshot(result, "hk_overview.json")
