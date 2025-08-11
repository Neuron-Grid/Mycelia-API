# Mycelia API

Mycelia API は、Supabase Auth と PostgreSQL(pgvector) を用いたアカウント分離・RLS前提のRSSリーダー用バックエンドです。NestJS 11 + BullMQ により、購読取得、ベクトル検索、日次要約、ポッドキャスト生成までを非同期で処理します。

注意: 本プロジェクトはベータ版です。APIやスキーマは今後変更される可能性があります。

## 主要機能

- 認証/アカウント管理: Supabase Auth (メール/パスワード, JWT) による登録・ログイン・更新・削除
- フィード管理: 購読の追加/更新/削除、手動取得、アイテムのページング取得
- タグ機能: 階層化タグ(最大5階層)、一括タグ付け、ツリー/パス/サブツリー取得、子孫含むフィルタ
- お気に入り: フィードアイテムのFavorite登録/解除
- ベクトル検索: OpenAI text-embedding-3-small + pgvector + HNSW インデックス
- 日次要約: Gemini 2.5 Flash を用いた24h要約、BullMQで1日1回/ユーザー
- ポッドキャスト: Geminiで台本生成 + Google Cloud TTS(Opus) で音声生成、R2へ保存
- ジョブ運用: BullMQキューの進行監視/再実行API、ユーザー毎スケジューリング

## セキュリティとアーキテクチャ

- RLS前提: 全ユーザーデータは `user_id = auth.uid()` 条件でRLSを適用。アプリも常に `user_id` を付与/検証
- SupabaseAuthGuard: `Authorization: Bearer <JWT>` を検証し、`request.user` を付与
- SupabaseRequestService: RLS有効(anon)とService-Role(管理/RPC用途)の2クライアントをリクエストスコープで提供
- 所有者のみアクセス: DBポリシー`owner_only` + コントローラ/リポジトリでの `userId` チェック
- ソフトデリート方針: users等の将来拡張用に `deleted_at`/`soft_deleted` を設計（実装中/一部テーブルで対応）

## 実行/開発

前提
- Node.js 20+
- pnpm 10+
- Redis (ローカルは Docker 推奨)
- Supabase プロジェクト

セットアップ
```bash
pnpm install
# Redis を起動（Compose V2）
docker compose -f compose.yml up -d redis

# 開発起動
pnpm start:dev

# ビルド/本番起動
pnpm build
pnpm start:prod
```

環境変数
- 具体的なキー値は `.env` を使用します（内容は公開しません）
- 例や用途は `.env.example` を参照してください（編集して実値を設定）
- ローカル開発では `NODE_ENV` の設定は必須ではありません（Swaggerは `NODE_ENV=development` のときに `/api/docs` が有効）

APIドキュメント
- 開発モードでは Swagger を `http://localhost:3000/api/docs` で提供します
- すべてのAPIプレフィックスは `/api/v1/` です

整形/規約
- Biome を採用: `pnpm format` または `biome check --write ./src`
- import は絶対パス (`src/...`) を使用

## ディレクトリ構成（主なもの）

```
src/
  app.module.ts, main.ts
  auth/            # 認証・アカウント管理（Supabase Auth）
  feed/            # 購読/フィード取得・スケジューラ・キュー
  tag/             # 階層タグと一括タグ付け
  favorite/        # お気に入り
  search/          # ベクトル検索（OpenAI + pgvector）
  embedding/       # 埋め込みバッチ更新（BullMQ）
  llm/             # 要約/台本生成（Gemini, BullMQ ワーカー）
  podcast/         # ポッドキャスト設定・エピソード生成/配信
  settings/        # 機能有効/無効・スケジュール・ステータス
  jobs/            # 管理向けジョブAPI・再実行など
  shared/, common/, types/, domain-config/
```

## 代表的なエンドポイント（抜粋）

認証（AuthController, version=v1, prefix=/api/v1/auth）
- `POST /api/v1/auth/signup` 登録（usernameはmetadata経由）
- `POST /api/v1/auth/login` ログイン
- `POST /api/v1/auth/logout` ログアウト（要JWT）
- `DELETE /api/v1/auth/delete` アカウント削除（要JWT）
- `PATCH /api/v1/auth/update-email`/`update-username`/`update-password`
- `POST /api/v1/auth/forgot-password`/`reset-password`/`verify-email`

フィード（FeedController, prefix=/api/v1/feed）
- `GET /api/v1/feed` 購読一覧（ページング）
- `POST /api/v1/feed` 購読追加（URL指定）
- `PATCH /api/v1/feed/:id` 購読更新 / `DELETE /api/v1/feed/:id` 購読削除
- `POST /api/v1/feed/:id/fetch` フィード手動取得
- `GET /api/v1/feed/:id/items` アイテム一覧（ページング）

タグ（TagController, prefix=/api/v1/tags、要JWT）
- 基本: `GET /` 一覧, `POST /` 作成, `PATCH /:tagId` 更新, `DELETE /:tagId` 削除
- ツリー: `GET /hierarchy`, `GET /:tagId/subtree`, `GET /:tagId/path`
- 高度作成: `POST /hierarchical`（description, color, embedding自動生成）
- 移動: `PATCH /:tagId/move`（循環/深度チェック）
- 紐付け: FeedItem `POST /feed-items/:id`, `DELETE /feed-items/:id?tagId=...`
- 一括: `POST /feed-items/:id/bulk`, `POST /subscriptions/:id/bulk`
- 検索: `GET /:tagId/feed-items?includeChildren=true`, `.../subscriptions?...`

お気に入り（FavoriteController, prefix=/api/v1/favorites）
- `GET /` 一覧, `POST /:feedItemId` 追加, `DELETE /:feedItemId` 解除
- `GET /:feedItemId/is-favorited` 判定

検索（SearchController, prefix=/api/v1/search）
- `GET /all|feed-items|summaries|podcasts?q=...` 類似検索（しきい値/件数指定）

埋め込みバッチ（EmbeddingController, prefix=/api/v1/embeddings）
- `POST /batch-update` テーブル別バッチ更新, `GET /progress` 進捗

要約/台本再生成（LLM SummaryController）
- `POST /api/v1/summaries/users/:userId/regenerate`
- `POST /api/v1/scripts/summaries/:summaryId/regenerate`

ポッドキャスト
- 設定: `GET/PUT /api/v1/podcast/config`
- エピソード: `GET /api/v1/podcast-episodes` 一覧, `POST /` 作成,
  `GET/PUT/DELETE /:id`, `POST /generate` 生成ジョブ投入

設定/スケジュール（SettingsController）
- `GET /api/v1/settings` 統合ビュー, `POST /schedule/reload|preview`,
  `PUT /settings/summary|podcast`

ジョブ運用（JobsAdminController, prefix=/api/v1/jobs）
- `GET /failed?queue=...`, `POST /:jobId/retry?queue=...`, `POST /failed/retry?queue=...`

詳細なAPI仕様はSwagger UIを参照してください。以下は暫定の詳細例です（抜粋）。

### エンドポイント例（詳細）

Auth
- サインアップ: `POST /api/v1/auth/signup`
  - body: `{ "email": "user@example.com", "password": "...", "username": "myname" }`
- ログイン: `POST /api/v1/auth/login`
  - body: `{ "email": "user@example.com", "password": "..." }`
- ログアウト: `POST /api/v1/auth/logout` (Bearer 必須)
- プロフィール変更: `PATCH /api/v1/auth/update-email|update-username|update-password`
- パスワード系: `POST /api/v1/auth/forgot-password|reset-password`, メール認証: `POST /api/v1/auth/verify-email`

Feed（購読）
- 購読一覧: `GET /api/v1/feed?page=1&limit=20`
- 追加: `POST /api/v1/feed` body: `{ "feedUrl": "https://example.com/rss.xml" }`
- 更新: `PATCH /api/v1/feed/:id` body 例: `{ "feedTitle": "新しいタイトル" }`
- 削除: `DELETE /api/v1/feed/:id`
- 手動取得: `POST /api/v1/feed/:id/fetch`
- アイテム一覧: `GET /api/v1/feed/:id/items?page=1&limit=50`

Tags（階層タグ）
- 一覧: `GET /api/v1/tags`
- 作成（基本）: `POST /api/v1/tags` body: `{ "tagName": "テクノロジー", "parentTagId": null }`
- 更新: `PATCH /api/v1/tags/:tagId` body: `{ "newName": "プログラミング", "newParentTagId": 1 }`
- 削除: `DELETE /api/v1/tags/:tagId`
- 作成（拡張・階層）: `POST /api/v1/tags/hierarchical`
  - body: `{ "tag_name": "JavaScript", "description": "Front-end runtime", "color": "#3B82F6", "parent_tag_id": 2 }`
- 移動（階層変更）: `PATCH /api/v1/tags/:tagId/move` body: `{ "new_parent_id": null }`
- ツリー取得: `GET /api/v1/tags/hierarchy`
- サブツリー: `GET /api/v1/tags/:tagId/subtree`
- パス取得: `GET /api/v1/tags/:tagId/path`
- 子孫含むフィード検索: `GET /api/v1/tags/:tagId/feed-items?includeChildren=true`
- 子孫含む購読検索: `GET /api/v1/tags/:tagId/subscriptions?includeChildren=true`
- 一括タグ付け（記事）: `POST /api/v1/tags/feed-items/:feedItemId/bulk` body: `{ "tagIds": [1,2,3] }`
- 一括タグ付け（購読）: `POST /api/v1/tags/subscriptions/:subscriptionId/bulk` body: `{ "tagIds": [1,5,8] }`

Favorites
- 一覧: `GET /api/v1/favorites`
- 追加: `POST /api/v1/favorites/:feedItemId`
- 解除: `DELETE /api/v1/favorites/:feedItemId`
- 判定: `GET /api/v1/favorites/:feedItemId/is-favorited`

Search（ベクトル検索）
- 全体検索: `GET /api/v1/search/all?q=query&limit=20&threshold=0.7&types=feed_item,summary,podcast`
- フィードのみ: `GET /api/v1/search/feed-items?q=...`
- サマリーのみ: `GET /api/v1/search/summaries?q=...`
- ポッドキャストのみ: `GET /api/v1/search/podcasts?q=...`

Embeddings（埋め込み）
- バッチ更新: `POST /api/v1/embeddings/batch-update` body: `{ "tableTypes": ["feed_items", "summaries", "tags"] }`
- 進捗: `GET /api/v1/embeddings/progress`

Summary/Script 再生成（LLM）
- 要約再生成: `POST /api/v1/summaries/users/:userId/regenerate` body: `{ "date": "YYYY-MM-DD", "prompt": "..." }`
- 台本再生成: `POST /api/v1/scripts/summaries/:summaryId/regenerate` body: `{ "prompt": "..." }`

Podcast
- 設定取得/更新: `GET /api/v1/podcast/config`, `PUT /api/v1/podcast/config`
  - 更新 body 例: `{ "podcast_enabled": true, "podcast_schedule_time": "06:00", "podcast_language": "ja-JP" }`
- エピソード: `GET /api/v1/podcast-episodes?page=1&limit=20`, `POST /api/v1/podcast-episodes`
- 個別取得/更新/削除: `GET|PUT|DELETE /api/v1/podcast-episodes/:id`
- 生成ジョブ投入: `POST /api/v1/podcast-episodes/generate` body: `{ "summary_id": 123 }`

Jobs（管理・自身のジョブのみ）
- 失敗一覧: `GET /api/v1/jobs/failed?queue=summary-generate|script-generate|podcastQueue|embeddingQueue`
- 単体リトライ: `POST /api/v1/jobs/:jobId/retry?queue=...`
- 一括リトライ: `POST /api/v1/jobs/failed/retry?queue=...` body: `{ "max": 100 }`

## 運用メモ

- インデックス/再生成: フィード登録/更新時にembedding追加、週1再構築（BullMQ）
- 1日1回の要約/ポッドキャスト: JST指定時刻 + 自動ジッター、24h内重複回避（jobId）
- ポッドキャストは要約が前提。有効化は要約有効時のみ可能

## トラブルシューティング（抜粋）

- Redis接続不可: `compose.yml` の `redis` を起動、`REDIS_*` を確認
- Supabase認証: `.env` のURL/鍵やRLS設定、CORS設定を確認
- Swagger未表示: `NODE_ENV=development` で起動し `/api/docs` を確認

## ライセンス

本プロジェクトは [Apache License 2.0](./LICENSE.txt) で提供されます。
