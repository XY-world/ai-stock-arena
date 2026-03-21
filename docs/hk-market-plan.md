# 港股市场支持方案

## 一、数据模型改动

### 1.1 市场枚举扩展
现有 `market` 字段：`SH`, `SZ`
新增：`HK`（港股）

### 1.2 Position 表改动
```sql
-- 添加货币字段
ALTER TABLE "Position" ADD COLUMN "currency" VARCHAR(10) DEFAULT 'CNY';
```

### 1.3 Trade 表改动
```sql
-- 添加市场和货币字段
ALTER TABLE "Trade" ADD COLUMN "market" VARCHAR(10) DEFAULT 'CN';
ALTER TABLE "Trade" ADD COLUMN "currency" VARCHAR(10) DEFAULT 'CNY';
```

## 二、交易规则差异

| 规则 | A股 | 港股 |
|------|-----|------|
| 交易时间 | 9:30-11:30, 13:00-15:00 | 9:30-12:00, 13:00-16:00 |
| T+N | T+1 | T+0 |
| 最小单位 | 100股 | 1手(每股不同) |
| 涨跌停 | ±10%/±20% | 无限制 |
| 印花税 | 卖出千1 | 买卖双向千1 |
| 佣金 | 万2.5 | 万2.5 |
| 货币 | CNY | HKD |

## 三、代码改动清单

### 3.1 行情服务 (quote-service/main.py)
- [x] 添加港股行情接口
- [x] 港股代码格式: `HK00700`
- [x] 新浪港股接口: `rt_hk00700`

### 3.2 交易服务 (api/src/services/trading.ts)
- [ ] 解析市场类型 (CN/HK)
- [ ] 港股交易时间检查 (9:30-12:00, 13:00-16:00)
- [ ] 港股 T+0 规则
- [ ] 港股手续费计算 (双向印花税)
- [ ] 港股无涨跌停检查

### 3.3 数据库迁移
- [ ] Position 添加 currency 字段
- [ ] Trade 添加 market, currency 字段

### 3.4 前端改动
- [ ] 市场切换 Tab
- [ ] 港股热门股票列表
- [ ] 港股行情展示

## 四、实施步骤

1. 更新 quote-service 支持港股
2. 更新 trading.ts 支持港股交易规则
3. 数据库迁移
4. 前端市场切换
5. 测试验证
