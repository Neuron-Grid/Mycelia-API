# はじめ方

RSS News APIを使用して、RSSフィードの管理と記事の収集を始めましょう。このガイドでは、APIの基本的な使い方を説明します。

## 前提条件

- RSS News APIのアカウント（まだ持っていない場合は[登録が必要](#ユーザー登録)）
- HTTP APIを呼び出すことができるツール（curl、Postman、その他のHTTPクライアント）

## ユーザー登録 {#ユーザー登録}

APIを使用するには、まずユーザー登録が必要です。以下のエンドポイントにPOSTリクエストを送信します：

```bash
curl -X POST https://api.example.com/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password",
    "username": "your-username"
  }'
```

登録に成功すると、確認メールが送信されます。メール内のリンクをクリックして、メールアドレスを確認してください。

## ログイン

登録したアカウントでログインして、APIアクセストークンを取得します：

```bash
curl -X POST https://api.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

成功すると、レスポンスにJWTトークンが含まれます。このトークンを保存し、以降のAPI呼び出しで使用します。

## APIの基本的な使い方

### 認証ヘッダーの設定

JWTトークンを使用して、認証が必要なエンドポイントにアクセスします：

```bash
curl -X GET https://api.example.com/api/v1/feed/subscriptions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### RSSフィードの購読

新しいRSSフィードを購読するには：

```bash
curl -X POST https://api.example.com/api/v1/feed/subscriptions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "feedUrl": "https://example.com/rss.xml"
  }'
```

### 購読中のフィード一覧の取得

現在購読中のフィード一覧を取得するには：

```bash
curl -X GET https://api.example.com/api/v1/feed/subscriptions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 次のステップ

- [認証ガイド](authentication.md) - 認証の詳細について学ぶ
- [フィード管理](feed-management.md) - フィードの管理方法の詳細
- [タグとお気に入り](tags-favorites.md) - コンテンツの整理方法

より詳細なAPI仕様については、[API リファレンス](../api/reference.md)を参照してください。