# builder
FROM node:22-alpine AS builder
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
RUN pnpm prune --prod --no-optional --config.ignore-scripts=true

# production
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S mycelia && adduser -S mycelia -G mycelia
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
RUN chown -R mycelia:mycelia /app
USER mycelia
EXPOSE 3000
CMD ["node", "/app/dist/main.api.js"]
