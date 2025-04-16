# RSS News API
## プロジェクト概要
`RSS News API`は、RSSフィードを購読・管理・閲覧するための高機能なバックエンドAPIサービスです。NestJSフレームワークを活用し、長期的な利用を前提とした設計を採用しているため、スマートフォンなどのデバイスを買い替えた際にも煩雑な移行作業を最小限に抑え、ベンダーロックインを回避しながら自由度の高いRSSリーダー体験を提供します。さらに、オープンな技術を採用することで多くのユーザーや開発者が参加しやすく、コミュニティ主導での機能強化やカスタマイズが期待される人気プロジェクトを目指しています。

### 主な機能
- ユーザー認証（Supabaseと連携）
- RSSフィードの購読管理
- フィードの自動・手動更新
- お気に入り機能
- タグ付け機能

## 技術スタック
- **バックエンド**: [NestJS](https://nestjs.com/) (v11)
- **認証**: [Supabase](https://supabase.io/)
- **データベース**: PostgreSQL（Supabase経由）
- **キャッシュ/キュー**: Redis, Bull
- **コンテナ化**: Docker
- **API文書**: Swagger
- **パッケージマネージャ**: pnpm

## セットアップ方法

### 前提条件
- Node.js v20以上
- pnpm v10以上
- Docker
- Supabaseプロジェクト

オプション
- Docker Compose
  - プロジェクトをコンテナ上で実行する場合は必要です

### ローカル開発環境のセットアップ
1. リポジトリをクローン
```bash
git clone https://github.com/Neuron-Grid/rss-news-api.git
cd rss-news-api
```

2. 依存関係のインストール
```bash
pnpm install
```

3. 環境変数の設定
`.env`ファイルをプロジェクトルートに作成し、以下の環境変数を設定します。
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PRODUCTION_DOMAIN=localhost:3000
REDIS_HOST=localhost
REDIS_PORT=6379
```

4. Redisの起動（Docker Composeを使用）
```bash
docker-compose up redis -d
```

5. アプリケーションの起動
```bash
# 開発モード
pnpm start:dev

# プロダクションモード
pnpm build
pnpm start:prod
```

### APIドキュメントへのアクセス
アプリケーションを起動した後、以下のURLでSwagger UIにアクセスできます。
```
http://localhost:3000/api-docs
```

## プロジェクト構造
プロジェクトは以下のような構造になっています。
```
rss-news-api/
├── src/                          # ソースコード
│   ├── app.module.ts             # メインモジュール
│   ├── main.ts                   # アプリケーションのエントリーポイント
│   ├── auth/                     # 認証関連
│   ├── feed/                     # フィード関連機能
│   │   ├── application/          # ユースケース・コントローラー
│   │   ├── domain/               # ドメインモデル
│   │   ├── infrastructure/       # リポジトリ
│   │   └── queue/                # キュー処理
│   ├── favorite/                 # お気に入り機能
│   ├── tag/                      # タグ機能
│   └── shared/                   # 共通コンポーネント
├── test/                         # テストファイル
├── Dockerfile                    # Dockerビルド設定
├── compose.yml                   # Docker Compose設定
├── package.json                  # パッケージ設定
└── nest-cli.json                 # NestJSの設定
```

## 主なモジュールと役割
### Auth モジュール
Supabaseを利用したユーザー認証機能を提供します。
- サインアップ/サインイン
- パスワード変更
- メール確認
- TOTP（二要素認証）

### Feed モジュール
RSSフィードの購読管理とフィードアイテムの取得・表示機能を提供します。
- 購読管理（追加・更新・削除）
- フィード手動更新
- フィードアイテム表示

### Tag モジュール
購読に対してタグ付けする機能を提供します。

### Favorite モジュール
フィードアイテムをお気に入りに登録する機能を提供します。

## API エンドポイント

### 認証関連
- `POST /api/v1/auth/signup` - 新規ユーザー登録
- `POST /api/v1/auth/signin` - ログイン
- `POST /api/v1/auth/verify-email` - メール確認
- `POST /api/v1/auth/forgot-password` - パスワードリセットメール送信
- `POST /api/v1/auth/reset-password` - パスワードリセット

### フィード関連
- `GET /api/v1/feed/subscriptions` - 購読一覧取得
- `POST /api/v1/feed/subscriptions` - 新規購読追加
- `PATCH /api/v1/feed/subscriptions/:id` - 購読更新
- `DELETE /api/v1/feed/subscriptions/:id` - 購読削除
- `POST /api/v1/feed/subscriptions/:id/fetch` - 購読を手動更新
- `GET /api/v1/feed/subscriptions/:id/items` - 購読のフィードアイテム取得

### お気に入り関連
- `GET /api/v1/favorites` - お気に入り一覧取得
- `POST /api/v1/favorites` - お気に入り追加
- `DELETE /api/v1/favorites/:id` - お気に入り削除

### タグ関連
- `GET /api/v1/tags` - タグ一覧取得
- `POST /api/v1/tags` - タグ作成
- `PATCH /api/v1/tags/:id` - タグ更新
- `DELETE /api/v1/tags/:id` - タグ削除

## 開発ガイド
### コード規約
このプロジェクトでは、以下のコード規約に従っています。
- [Biome](https://biomejs.dev/)を使用したコード整形
- NestJSの推奨するディレクトリ構造
- クリーンアーキテクチャ（Application, Domain, Infrastructure）
### テスト実行
```bash
# ユニットテスト
pnpm test

# E2Eテスト
pnpm test:e2e

# カバレッジレポート
pnpm test:cov
```

## Dockerを使用したデプロイ
### コンテナビルド
```bash
docker build -t rss-news-api .
```

### Docker Composeでの起動
`compose.yml`を編集して、コメントアウトされている`rss-news-api`サービスの設定を有効にします。
その後、以下のコマンドで起動できます。
```bash
docker-compose up -d
```

## 運用上の注意点
### バックグラウンドジョブ
このアプリケーションでは、Redisとともに`Bull`を使用して、フィードの定期的な更新を行います。
以下の点に注意してください。
- Redisが稼働している必要があります
- 本番環境ではRedisの永続性と高可用性について検討してください

### 環境変数
機密情報やデプロイ環境に依存する設定は環境変数で管理しています。本番環境では適切に設定してください。

## トラブルシューティング

### よくある問題
1. **Redisに接続できない**
  - Redisが起動しているか確認
  - 環境変数`REDIS_HOST`と`REDIS_PORT`が正しく設定されているか確認

2. **Supabase認証エラー**
  - Supabaseの認証キーが正しいか確認
  - Supabaseプロジェクトの設定を確認

3. **RSSフィードが取得できない**
  - URLが正しいか確認
  - ターゲットサイトがRSSを提供しているか確認
  - ネットワーク接続を確認

## 貢献について
バグ報告や機能リクエストは、GitHubのIssueを通じて行ってください。

---

このプロジェクトは[Apache License 2.0](./LICENSE)の下で提供されています。