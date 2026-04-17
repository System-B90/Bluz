# check=skip=SecretsUsedInArgOrEnv
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
RUN mkdir ui

FROM deps AS dev
WORKDIR /app
COPY . .
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY=ci_placeholder
ENV WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY=$WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY

RUN npm run build
# Combined migration build if possible, or keep separate if logic differs
RUN npx tsc ui/src/api-server/drizzle-migrate.ts --outDir ./dist-migrate --esModuleInterop --skipLibCheck

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/ui/public ./ui/public

RUN mkdir -p ui/.next && chown nextjs:nodejs ui/.next

COPY --from=builder --chown=nextjs:nodejs /app/ui/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/ui/.next/static ./ui/.next/static

COPY drizzle ./drizzle
COPY --from=builder /app/dist-migrate/drizzle-migrate.js ./migrate.js

COPY ui/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
# Standalone server generated inside the ui directory structure
CMD ["node", "ui/server.js"]