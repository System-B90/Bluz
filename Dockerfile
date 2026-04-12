# check=skip=SecretsUsedInArgOrEnv
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM deps AS dev
COPY . .

FROM node:22-alpine AS builder
WORKDIR /app

ARG WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY=ci_placeholder
ARG WEBSOCKET_SESSION_SERVER_HOST=localhost
ARG WEBSOCKET_SESSION_SERVER_PORT=443

ENV WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY=$WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY
ENV WEBSOCKET_SESSION_SERVER_HOST=$WEBSOCKET_SESSION_SERVER_HOST
ENV WEBSOCKET_SESSION_SERVER_PORT=$WEBSOCKET_SESSION_SERVER_PORT

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build
RUN npx tsc src/api-server/drizzle-migrate.ts --outDir ./dist-migrate --esModuleInterop --skipLibCheck

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

RUN mkdir .next && chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./

COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps /app/node_modules/pg ./node_modules/pg

COPY drizzle ./drizzle
COPY --from=builder /app/dist-migrate/drizzle-migrate.js ./migrate.js

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
