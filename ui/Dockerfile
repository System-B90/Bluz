# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY ui/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

FROM deps AS dev
WORKDIR /app
COPY . .
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXTAUTH_SECRET=ci_build_placeholder

RUN npm run build
RUN npx tsc ui/src/api-server/drizzle-migrate.ts --outDir /app/dist-migrate --esModuleInterop --skipLibCheck
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

RUN mkdir -p ui/.next && chown nextjs:nodejs ui/.next

COPY --from=builder --chown=nextjs:nodejs /app/ui/public ./ui/public
COPY --from=builder --chown=nextjs:nodejs /app/ui/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/ui/.next/static ./ui/.next/static
COPY --from=deps --chown=nextjs:nodejs /usr/local/bin/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

COPY drizzle ./drizzle
COPY --from=builder /app/dist-migrate/drizzle-migrate.js ./migrate.js

USER nextjs
EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "ui/server.js"]
