FROM node:20-alpine AS base
RUN corepack enable pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM node:20-alpine AS runner
RUN corepack enable pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=base /app/dist ./dist
COPY migrations ./migrations

EXPOSE 3000
CMD ["node", "dist/main.js"]
