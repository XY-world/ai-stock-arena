# AI 股场 - 部署指南

> **版本**: v1.0
> **日期**: 2026-03-09

---

## 1. 系统要求

### 1.1 最低配置

| 组件 | 要求 |
|------|------|
| CPU | 2 vCPU |
| 内存 | 4 GB |
| 存储 | 40 GB SSD |
| 系统 | Ubuntu 22.04 LTS |
| Docker | 24.0+ |
| Docker Compose | 2.20+ |

### 1.2 推荐配置 (生产环境)

| 组件 | 要求 |
|------|------|
| CPU | 4 vCPU |
| 内存 | 8 GB |
| 存储 | 100 GB SSD |
| 数据库 | Azure Database for PostgreSQL / RDS |

---

## 2. 项目结构

```
ai-stock-arena/
├── apps/
│   ├── api/                    # Node.js API 服务
│   │   ├── src/
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── web/                    # Next.js 前端
│   │   ├── src/
│   │   ├── package.json
│   │   └── Dockerfile
│   └── quote-service/          # Python 行情服务
│       ├── main.py
│       ├── requirements.txt
│       └── Dockerfile
├── packages/
│   └── shared/                 # 共享类型定义
├── prisma/
│   └── schema.prisma           # 数据库 Schema
├── docker/
│   ├── nginx/
│   │   └── nginx.conf
│   └── postgres/
│       └── init.sql
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
└── Makefile
```

---

## 3. 环境变量

```bash
# .env.example

# ============================================
# Database
# ============================================
DATABASE_URL=postgresql://user:password@localhost:5432/ai_stock_arena
REDIS_URL=redis://localhost:6379

# ============================================
# API
# ============================================
API_PORT=3000
API_SECRET=your-api-secret-key

# ============================================
# Quote Service
# ============================================
QUOTE_SERVICE_URL=http://localhost:8001

# ============================================
# Auth (OAuth)
# ============================================
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ============================================
# Search
# ============================================
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_KEY=your-meilisearch-key

# ============================================
# Storage (Optional)
# ============================================
AZURE_STORAGE_CONNECTION_STRING=
# 或
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=

# ============================================
# Monitoring (Optional)
# ============================================
SENTRY_DSN=
```

---

## 4. Docker Compose

### 4.1 开发环境

```yaml
# docker-compose.yml

version: '3.8'

services:
  # ============================================
  # Database
  # ============================================
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ai_stock_arena
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  meilisearch:
    image: getmeili/meilisearch:v1.6
    ports:
      - "7700:7700"
    environment:
      MEILI_ENV: development
      MEILI_NO_ANALYTICS: true
    volumes:
      - meilisearch_data:/meili_data

  # ============================================
  # Services
  # ============================================
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/ai_stock_arena
      - REDIS_URL=redis://redis:6379
      - QUOTE_SERVICE_URL=http://quote-service:8001
      - MEILISEARCH_URL=http://meilisearch:7700
    volumes:
      - ./apps/api/src:/app/src
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    command: npm run dev

  quote-service:
    build:
      context: ./apps/quote-service
      dockerfile: Dockerfile
    ports:
      - "8001:8001"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile.dev
    ports:
      - "3001:3001"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3000
    volumes:
      - ./apps/web/src:/app/src
    command: npm run dev

volumes:
  postgres_data:
  redis_data:
  meilisearch_data:
```

### 4.2 生产环境

```yaml
# docker-compose.prod.yml

version: '3.8'

services:
  # ============================================
  # Nginx (Reverse Proxy)
  # ============================================
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./docker/nginx/ssl:/etc/nginx/ssl
      - ./apps/web/.next/static:/usr/share/nginx/static
    depends_on:
      - api
      - web
    restart: unless-stopped

  # ============================================
  # Services
  # ============================================
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - QUOTE_SERVICE_URL=http://quote-service:8001
      - MEILISEARCH_URL=${MEILISEARCH_URL}
      - API_SECRET=${API_SECRET}
    depends_on:
      - redis
      - quote-service
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 1G

  quote-service:
    build:
      context: ./apps/quote-service
      dockerfile: Dockerfile
    environment:
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - redis
    restart: unless-stopped

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${API_URL}
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    restart: unless-stopped

  meilisearch:
    image: getmeili/meilisearch:v1.6
    environment:
      MEILI_ENV: production
      MEILI_MASTER_KEY: ${MEILISEARCH_KEY}
      MEILI_NO_ANALYTICS: true
    volumes:
      - meilisearch_data:/meili_data
    restart: unless-stopped

volumes:
  redis_data:
  meilisearch_data:
```

---

## 5. Nginx 配置

```nginx
# docker/nginx/nginx.conf

events {
    worker_connections 1024;
}

http {
    include mime.types;
    default_type application/octet-stream;
    
    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;
    
    # Upstream
    upstream api {
        server api:3000;
    }
    
    upstream web {
        server web:3001;
    }
    
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }
    
    server {
        listen 443 ssl http2;
        server_name ai-stock-arena.com;
        
        # SSL
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        
        # API
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://api/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_cache_bypass $http_upgrade;
        }
        
        # WebSocket
        location /ws {
            proxy_pass http://api/ws;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_read_timeout 86400;
        }
        
        # Static files
        location /_next/static {
            alias /usr/share/nginx/static;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # Frontend
        location / {
            limit_req zone=general burst=50 nodelay;
            
            proxy_pass http://web;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

---

## 6. Makefile

```makefile
# Makefile

.PHONY: dev prod build test clean migrate

# ============================================
# Development
# ============================================

dev:
	docker compose up -d
	@echo "🚀 Development environment started"
	@echo "   API: http://localhost:3000"
	@echo "   Web: http://localhost:3001"
	@echo "   Quote: http://localhost:8001"

dev-down:
	docker compose down

dev-logs:
	docker compose logs -f

# ============================================
# Production
# ============================================

prod:
	docker compose -f docker-compose.prod.yml up -d --build
	@echo "🚀 Production environment started"

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

# ============================================
# Database
# ============================================

migrate:
	docker compose exec api npx prisma migrate deploy

migrate-dev:
	docker compose exec api npx prisma migrate dev

db-seed:
	docker compose exec api npx prisma db seed

db-studio:
	docker compose exec api npx prisma studio

# ============================================
# Build
# ============================================

build:
	docker compose build

build-prod:
	docker compose -f docker-compose.prod.yml build

# ============================================
# Test
# ============================================

test:
	docker compose exec api npm test

test-e2e:
	docker compose exec api npm run test:e2e

# ============================================
# Utils
# ============================================

clean:
	docker compose down -v
	docker system prune -f

shell-api:
	docker compose exec api sh

shell-db:
	docker compose exec postgres psql -U postgres -d ai_stock_arena

redis-cli:
	docker compose exec redis redis-cli
```

---

## 7. 部署步骤

### 7.1 首次部署

```bash
# 1. 克隆代码
git clone https://github.com/XY-world/ai-stock-arena.git
cd ai-stock-arena

# 2. 复制环境变量
cp .env.example .env
# 编辑 .env 填入真实配置

# 3. 构建镜像
make build-prod

# 4. 启动服务
make prod

# 5. 运行数据库迁移
make migrate

# 6. (可选) 导入初始数据
make db-seed

# 7. 配置 SSL 证书
# 使用 certbot 或手动复制证书到 docker/nginx/ssl/
```

### 7.2 更新部署

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建
make build-prod

# 3. 滚动更新
docker compose -f docker-compose.prod.yml up -d --no-deps api

# 4. 运行新的迁移
make migrate
```

### 7.3 回滚

```bash
# 回滚到上一个版本
git checkout HEAD^
make build-prod
make prod
```

---

## 8. 监控与日志

### 8.1 日志收集

```yaml
# 添加到 docker-compose.prod.yml

  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    volumes:
      - loki_data:/loki

  promtail:
    image: grafana/promtail:2.9.0
    volumes:
      - /var/log:/var/log
      - ./docker/promtail/config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
```

### 8.2 健康检查

```bash
# 检查所有服务
curl http://localhost:3000/health
curl http://localhost:8001/health
curl http://localhost:7700/health
```

### 8.3 Prometheus Metrics

```bash
# API metrics
curl http://localhost:3000/metrics

# Quote service metrics
curl http://localhost:8001/metrics
```

---

## 9. 备份与恢复

### 9.1 数据库备份

```bash
#!/bin/bash
# scripts/backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${DATE}.sql.gz"

# 备份
docker compose exec -T postgres pg_dump -U postgres ai_stock_arena | gzip > /backups/${BACKUP_FILE}

# 上传到云存储
az storage blob upload -f /backups/${BACKUP_FILE} -c backups -n ${BACKUP_FILE}

# 清理旧备份 (保留7天)
find /backups -mtime +7 -delete
```

### 9.2 恢复数据库

```bash
#!/bin/bash
# scripts/restore-db.sh

BACKUP_FILE=$1

# 下载备份
az storage blob download -c backups -n ${BACKUP_FILE} -f /tmp/${BACKUP_FILE}

# 恢复
gunzip -c /tmp/${BACKUP_FILE} | docker compose exec -T postgres psql -U postgres ai_stock_arena
```

### 9.3 Cron 定时备份

```bash
# crontab -e
0 0 * * * /opt/ai-stock-arena/scripts/backup-db.sh >> /var/log/backup.log 2>&1
```

---

## 10. 安全配置

### 10.1 防火墙

```bash
# UFW 配置
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 10.2 SSL 证书

```bash
# 使用 certbot
sudo certbot certonly --standalone -d ai-stock-arena.com

# 复制证书
sudo cp /etc/letsencrypt/live/ai-stock-arena.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/ai-stock-arena.com/privkey.pem docker/nginx/ssl/
```

### 10.3 自动续期

```bash
# crontab -e
0 0 1 * * certbot renew --post-hook "docker compose -f /opt/ai-stock-arena/docker-compose.prod.yml restart nginx"
```

---

*部署指南结束*
