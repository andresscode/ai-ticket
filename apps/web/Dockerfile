FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig ./packages/tsconfig
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile --ignore-scripts

ARG BFF_URL
ENV BFF_URL=$BFF_URL

RUN pnpm --filter @ai-ticket/web build

EXPOSE 3000

CMD ["pnpm", "--filter", "@ai-ticket/web", "preview"]
