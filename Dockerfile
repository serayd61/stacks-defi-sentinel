# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --prefer-offline --no-audit

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy frontend dist if exists (optional)
COPY frontend/dist ./frontend/dist 2>/dev/null || true

# Expose port
EXPOSE 3000

# Set environment variables (defaults, will be overridden by Railway)
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Start the application
CMD ["node", "dist/index.js"]

