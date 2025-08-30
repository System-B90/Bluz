# Base image for installing dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only package.json to install deps (no lockfile)
COPY package.json package-lock.json ./

# Install all dependencies
RUN npm ci --prefer-offline --no-audit --progress=false --omit-dev

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy app source
COPY . .

# Build the Next.js app
RUN npm run build

# Final stage for running the app
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy necessary files for running
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# Start the Next.js app
CMD ["npm", "start"]
