.PHONY: dev build start stop logs clean migrate

# ============================================
# Development
# ============================================

dev:
	docker compose up -d postgres redis
	@echo "🚀 Database and Redis started"
	@echo "Run 'cd apps/api && npm run dev' for API"
	@echo "Run 'cd apps/web && npm run dev' for Web"
	@echo "Run 'cd apps/quote-service && python main.py' for Quote Service"

# ============================================
# Production
# ============================================

build:
	docker compose build

start:
	docker compose up -d
	@echo "🚀 All services started"
	@echo "   API: http://localhost:3000"
	@echo "   Web: http://localhost:3001"
	@echo "   Quote: http://localhost:8001"

stop:
	docker compose down

logs:
	docker compose logs -f

# ============================================
# Database
# ============================================

migrate:
	docker compose exec api npx prisma migrate deploy

migrate-dev:
	cd apps/api && npx prisma migrate dev

db-push:
	cd apps/api && npx prisma db push

db-studio:
	cd apps/api && npx prisma studio

db-seed:
	docker compose exec api npx prisma db seed

# ============================================
# Utils
# ============================================

clean:
	docker compose down -v
	docker system prune -f

shell-api:
	docker compose exec api sh

shell-db:
	docker compose exec postgres psql -U aistock -d ai_stock_arena

redis-cli:
	docker compose exec redis redis-cli

# ============================================
# SSL (Let's Encrypt)
# ============================================

ssl-init:
	mkdir -p docker/nginx/ssl
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout docker/nginx/ssl/privkey.pem \
		-out docker/nginx/ssl/fullchain.pem \
		-subj "/CN=localhost"
	@echo "Self-signed certificate created"
