FROM node:20-alpine AS base
WORKDIR /repo
RUN apk add --no-cache openssl
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json pnpm-lock.yaml ./
COPY packages/db/package.json packages/db/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN pnpm install --frozen-lockfile

COPY packages/db packages/db
COPY apps/worker apps/worker
RUN pnpm --filter db prisma:generate
RUN pnpm --filter worker build

CMD ["node", "apps/worker/dist/index.js"]
