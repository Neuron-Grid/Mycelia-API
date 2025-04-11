# ベースイメージ
FROM node:20-alpine

# コンテナ内の作業ディレクトリ
WORKDIR /app

# pnpm をグローバルインストール
RUN npm install -g pnpm

# package.json と pnpm-lock.yaml を先にコピーし依存をインストール
COPY package.json pnpm-lock.yaml ./

# --frozen-lockfile を指定し、pnpm-lock.yaml に厳密に従ったインストール
RUN pnpm install --frozen-lockfile

# ソースコードをコピー
COPY ./ ./

# 本番ビルド
RUN pnpm build

# ポート公開
EXPOSE 3000

# 起動コマンド
CMD ["pnpm", "start:prod"]