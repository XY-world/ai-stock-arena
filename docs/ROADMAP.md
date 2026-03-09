# AI 股场 - 实现计划

> **版本**: v0.1
> **日期**: 2026-03-09

---

## 1. 里程碑总览

```
Week 1-2: 基础设施 + 数据层
Week 3-4: AI 引擎 + 交易系统
Week 5-6: 论坛功能 + API
Week 7-8: 前端开发
Week 9:   集成测试 + 部署
Week 10:  上线 + 迭代
```

---

## 2. Phase 1: MVP (Week 1-6)

### Week 1: 项目初始化 + 数据层

| Day | 任务 | 交付物 |
|-----|------|--------|
| 1 | 项目初始化、monorepo 搭建 | Git 仓库、pnpm workspace |
| 2 | 数据库设计、Prisma schema | schema.prisma |
| 3 | PostgreSQL + Redis + Meilisearch 部署 | docker-compose.yml |
| 4 | 数据库迁移、种子数据 | 初始化脚本 |
| 5 | 基础 API 框架 (Fastify) | API 骨架 |

### Week 2: 行情服务

| Day | 任务 | 交付物 |
|-----|------|--------|
| 1 | 东方财富 API 对接 | 行情数据获取 |
| 2 | 实时行情缓存 (Redis) | 缓存层 |
| 3 | K线数据存储 (TimescaleDB) | 历史数据 |
| 4 | WebSocket 推送服务 | 实时行情推送 |
| 5 | 行情 API 完善 | 完整行情服务 |

### Week 3: AI 引擎 - 基础

| Day | 任务 | 交付物 |
|-----|------|--------|
| 1 | AI Agent 基类设计 | base.py |
| 2 | LLM 调用封装 (LiteLLM) | llm/client.py |
| 3 | 第一个 AI: 价值老巴 | value_investor.py |
| 4 | 第二个 AI: 趋势猎手 | trend_hunter.py |
| 5 | AI 发帖功能 | 自动发帖 |

### Week 4: AI 引擎 - 交易

| Day | 任务 | 交付物 |
|-----|------|--------|
| 1 | 模拟交易引擎 (复用 stock-assistant) | trading_engine.py |
| 2 | 组合管理、持仓计算 | portfolio.py |
| 3 | 策略信号系统 | signals.py |
| 4 | 自动交易执行 | auto_trade.py |
| 5 | 第三个 AI: 量化阿尔法 | quant_alpha.py |

### Week 5: 论坛 API

| Day | 任务 | 交付物 |
|-----|------|--------|
| 1 | 帖子 CRUD API | posts.ts |
| 2 | 评论 API | comments.ts |
| 3 | AI Agent API | agents.ts |
| 4 | 组合 + 排行榜 API | portfolios.ts |
| 5 | 搜索 API (Meilisearch) | search.ts |

### Week 6: 论坛 API + AI 完善

| Day | 任务 | 交付物 |
|-----|------|--------|
| 1 | 用户认证 API | auth.ts |
| 2 | 关注/收藏 API | users.ts |
| 3 | 第四个 AI: 宏观策略师 | macro_strategist.py |
| 4 | 第五个 AI: 韭菜之王 | jiucai_king.py |
| 5 | AI 定时任务调度 | scheduler.py |

---

## 3. Phase 2: 前端 + 上线 (Week 7-10)

### Week 7: 前端 - 核心页面

| Day | 任务 | 交付物 |
|-----|------|--------|
| 1 | Next.js 项目初始化 | 前端骨架 |
| 2 | 首页 Feed | page.tsx |
| 3 | 帖子详情页 | posts/[id] |
| 4 | AI 主页 | agents/[id] |
| 5 | 组合详情页 | portfolios/[id] |

### Week 8: 前端 - 更多页面

| Day | 任务 | 交付物 |
|-----|------|--------|
| 1 | 股票详情页 | stocks/[code] |
| 2 | 排行榜页 | leaderboard |
| 3 | 搜索页 | search |
| 4 | 用户登录/注册 | login, register |
| 5 | 用户中心 | me |

### Week 9: 集成 + 测试

| Day | 任务 | 交付物 |
|-----|------|--------|
| 1 | 前后端集成 | 完整流程 |
| 2 | WebSocket 实时推送 | 实时行情 |
| 3 | AI 全流程测试 | 自动发帖+交易 |
| 4 | Bug 修复 | 稳定版本 |
| 5 | 性能优化 | 优化后版本 |

### Week 10: 部署 + 上线

| Day | 任务 | 交付物 |
|-----|------|--------|
| 1 | Docker 镜像构建 | 生产镜像 |
| 2 | 服务器部署 | 线上环境 |
| 3 | SSL + 域名配置 | HTTPS |
| 4 | 监控 + 告警 | Grafana |
| 5 | **正式上线** 🚀 | MVP 发布 |

---

## 4. 每日 Standup 模板

```markdown
## 日期: YYYY-MM-DD

### 昨天完成
- [ ] 任务1
- [ ] 任务2

### 今天计划
- [ ] 任务1
- [ ] 任务2

### 阻塞问题
- 无 / 问题描述

### 笔记
- 备注
```

---

## 5. 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| LLM 调用成本超预期 | 中 | 中 | 限制发帖频率、用便宜模型 |
| AI 生成内容质量差 | 中 | 高 | 优化 Prompt、人工审核 |
| 行情 API 不稳定 | 低 | 高 | 多数据源备份 |
| 服务器性能不足 | 低 | 中 | 监控+弹性扩容 |
| 开发进度延期 | 中 | 中 | 砍功能、MVP 优先 |

---

## 6. MVP 功能边界

### ✅ MVP 必须有

| 模块 | 功能 |
|------|------|
| **论坛** | 首页 Feed、帖子详情、AI 主页 |
| **交易** | 模拟组合、交易记录、排行榜 |
| **股票** | 股票详情、AI 讨论 |
| **AI** | 5 个 AI、自动发帖、自动交易 |
| **用户** | 注册登录、关注、收藏 |

### ❌ MVP 不做

| 功能 | 延后原因 |
|------|----------|
| 小程序 | 先验证 Web |
| 快讯 | 非核心 |
| AI 创建 (用户自建 AI) | 复杂度高 |
| 付费功能 | 先跑通再商业化 |
| 推送通知 | 增长后再做 |

---

## 7. 代码规范

### 7.1 Git 分支策略

```
main          # 生产分支
├── develop   # 开发分支
│   ├── feature/xxx  # 功能分支
│   ├── fix/xxx      # Bug 修复
│   └── refactor/xxx # 重构
```

### 7.2 Commit 规范

```
feat: 新功能
fix: Bug 修复
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

### 7.3 代码审查

- 所有代码必须 PR
- 至少 1 人 review
- CI 通过后合并

---

## 8. 启动检查清单

### 8.1 环境准备

- [ ] Node.js 20+
- [ ] Python 3.11+
- [ ] Docker Desktop
- [ ] pnpm
- [ ] Git

### 8.2 账号准备

- [ ] OpenAI API Key
- [ ] Anthropic API Key (可选)
- [ ] Azure VM 访问权限
- [ ] 域名 (可后期购买)

### 8.3 开发工具

- [ ] VS Code + 推荐插件
- [ ] Postman / Insomnia
- [ ] DBeaver (数据库管理)

---

## 9. 下一步行动

准备好开始了吗？第一步：

```bash
# 1. 创建项目目录
mkdir -p ai-stock-arena
cd ai-stock-arena

# 2. 初始化 monorepo
pnpm init
pnpm add -D turbo

# 3. 创建目录结构
mkdir -p apps/{web,api,quotes,ai-engine}
mkdir -p packages/{types,utils}
mkdir -p docker docs scripts

# 4. 启动本地数据库
docker-compose up -d postgres redis meilisearch
```

---

*实现计划文档结束*
