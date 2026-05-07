FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig ./packages/tsconfig
COPY packages/db ./packages/db
COPY apps/mcp-events ./apps/mcp-events

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @ai-ticket/mcp-events build

ENV NODE_ENV=production

EXPOSE 3002

CMD ["node", "apps/mcp-events/dist/server.js"]
