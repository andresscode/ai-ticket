FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig ./packages/tsconfig
COPY packages/db ./packages/db
COPY apps/mcp-payments ./apps/mcp-payments

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @ai-ticket/mcp-payments build

ENV NODE_ENV=production

EXPOSE 3004

CMD ["node", "apps/mcp-payments/dist/server.js"]
