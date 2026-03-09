FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Copy built files
COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
