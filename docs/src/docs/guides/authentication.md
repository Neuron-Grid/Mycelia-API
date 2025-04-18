# 認証ガイド

RSS News APIでは、JWTベースの認証システムを使用しています。このガイドでは、APIの認証関連機能について詳しく説明します。

## ユーザーアカウント管理

### 新規ユーザー登録

新しいユーザーアカウントを作成するには：

```bash
curl -X POST https://api.example.com/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password",
    "username": "your-username"
  }'
```

登録に成功すると、確認メールが送信されます。

### メールアドレスの確認

登録後に送信される確認メールのリンクをクリックするか、トークンを使用して手動で確認します：

```bash
curl -X POST https://api.example.com/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "token": "verification_token_from_email"
  }'
```

### ログイン（アクセストークンの取得）

アカウントにログインしてアクセストークンを取得するには：

```bash
curl -X POST https://api.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

成功すると、JWTトークンが返されます：

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### ログアウト

現在のセッションからログアウトするには：

```bash
curl -X POST https://api.example.com/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## パスワード管理

### パスワードリセットの要求

パスワードを忘れた場合、リセットメールを送信できます：

```bash
curl -X POST https://api.example.com/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com"
  }'
```

### パスワードのリセット

リセットメールから取得したトークンを使用して、新しいパスワードを設定します：

```bash
curl -X POST https://api.example.com/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "token_from_reset_email",
    "newPassword": "your-new-password"
  }'
```

### パスワードの更新

ログイン状態で、現在のパスワードを変更するには：

```bash
curl -X PATCH https://api.example.com/api/v1/auth/update-password \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "your-current-password",
    "newPassword": "your-new-password"
  }'
```

## プロフィール管理

### プロフィール情報の取得

現在のユーザープロフィールを取得するには：

```bash
curl -X GET https://api.example.com/api/v1/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### メールアドレスの更新

ログイン状態で、メールアドレスを変更するには：

```bash
curl -X PATCH https://api.example.com/api/v1/auth/update-email \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newEmail": "your-new-email@example.com"
  }'
```

### ユーザー名の更新

ログイン状態で、ユーザー名を変更するには：

```bash
curl -X PATCH https://api.example.com/api/v1/auth/update-username \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newUsername": "your-new-username"
  }'
```

## 二要素認証

### TOTP認証の確認

二要素認証（TOTP）を使用している場合、コードを確認するには：

```bash
curl -X POST https://api.example.com/api/v1/auth/verify-totp \
  -H "Content-Type: application/json" \
  -d '{
    "factorId": "totp_factor_id",
    "code": "123456"
  }'
```

## アカウントの削除

アカウントを完全に削除するには：

```bash
curl -X DELETE https://api.example.com/api/v1/auth/delete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

!!! warning "注意"
    アカウントを削除すると、すべてのデータが完全に削除され、復元できなくなります。この操作は取り消せません。

## トークンの使用方法

取得したJWTトークンは、認証が必要な全てのAPIリクエストの`Authorization`ヘッダーに含める必要があります：

```bash
curl -X GET https://api.example.com/api/v1/endpoint \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

トークンは有効期限があり、期限切れになった場合は再度ログインする必要があります。