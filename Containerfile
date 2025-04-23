FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY ./ ./
RUN pnpm build

FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json                     ./
EXPOSE 3000
CMD ["pnpm","run","start:prod"]