# syntax=docker/dockerfile:1.7

FROM node:20-bullseye-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm build

FROM node:20-bullseye-slim AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV="production"
ENV PORT="3000"

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/server/package.json ./packages/server/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY prisma/schema.prisma ./prisma/schema.prisma

RUN pnpm install --prod --frozen-lockfile && pnpm store prune

COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/client/dist ./packages/client/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/prisma ./prisma
COPY scripts ./scripts

RUN mkdir -p /app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((res)=>{if(!res.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "scripts/docker-entrypoint.mjs"]
