FROM node:20-alpine AS base
WORKDIR /repo
RUN apk add --no-cache openssl
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json pnpm-lock.yaml ./
COPY packages/db/package.json packages/db/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN pnpm install --frozen-lockfile

COPY packages/db packages/db
COPY apps/web apps/web
RUN pnpm --filter db prisma:generate
RUN pnpm --filter web build

EXPOSE 3000
CMD sh -c "pnpm --filter db exec prisma migrate deploy && pnpm --filter web start"
