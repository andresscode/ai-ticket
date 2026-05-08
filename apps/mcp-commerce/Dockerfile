FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig ./packages/tsconfig
COPY packages/db ./packages/db
COPY apps/mcp-commerce ./apps/mcp-commerce

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @ai-ticket/mcp-commerce build

ENV NODE_ENV=production

EXPOSE 3003

CMD ["node", "apps/mcp-commerce/dist/server.js"]
