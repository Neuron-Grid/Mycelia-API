# タグとお気に入り

RSS News APIでは、フィード記事を整理するためのタグ付け機能と、重要な記事を保存するためのお気に入り機能を提供しています。このガイドでは、これらの機能の使用方法について説明します。

## タグ管理

タグを使用すると、フィード記事やフィード購読を分類し、効率的に管理できます。

### タグ一覧の取得

現在のユーザーが作成したすべてのタグを取得するには：

```bash
curl -X GET https://api.example.com/api/v1/tags \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 新しいタグの作成

新しいタグを作成するには：

```bash
curl -X POST https://api.example.com/api/v1/tags \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tagName": "Technology"
  }'
```

親タグを指定して階層構造を作ることもできます：

```bash
curl -X POST https://api.example.com/api/v1/tags \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tagName": "Programming",
    "parentTagId": 1
  }'
```

この例では、「Technology」タグ（ID: 1と仮定）の子タグとして「Programming」を作成しています。

### タグの更新

既存のタグ名や親タグを更新するには：

```bash
curl -X PATCH https://api.example.com/api/v1/tags/{tagId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newName": "Updated Tag Name",
    "newParentTagId": 2
  }'
```

`{tagId}`は更新するタグのIDに置き換えてください。

### タグの削除

タグを削除するには：

```bash
curl -X DELETE https://api.example.com/api/v1/tags/{tagId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

`{tagId}`は削除するタグのIDに置き換えてください。

## フィード記事へのタグ付け

### 記事のタグ一覧取得

特定のフィード記事に付けられたタグを取得するには：

```bash
curl -X GET https://api.example.com/api/v1/tags/feed-items/{feedItemId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

`{feedItemId}`はタグを取得したいフィード記事のIDに置き換えてください。

### 記事へのタグ付け

フィード記事にタグを付けるには：

```bash
curl -X POST https://api.example.com/api/v1/tags/feed-items/{feedItemId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tagId": 1
  }'
```

`{feedItemId}`はタグを付けたいフィード記事のIDに置き換え、リクエストボディの`tagId`は付けたいタグのIDを指定してください。

### 記事からのタグ削除

フィード記事からタグを削除するには：

```bash
curl -X DELETE https://api.example.com/api/v1/tags/feed-items/{feedItemId}?tagId={tagId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

`{feedItemId}`はタグを削除したいフィード記事のID、`{tagId}`は削除したいタグのIDに置き換えてください。

## 購読フィードへのタグ付け

### 購読フィードのタグ一覧取得

特定の購読フィードに付けられたタグを取得するには：

```bash
curl -X GET https://api.example.com/api/v1/tags/subscriptions/{subscriptionId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

`{subscriptionId}`はタグを取得したい購読フィードのIDに置き換えてください。

### 購読フィードへのタグ付け

購読フィードにタグを付けるには：

```bash
curl -X POST https://api.example.com/api/v1/tags/subscriptions/{subscriptionId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tagId": 1
  }'
```

`{subscriptionId}`はタグを付けたい購読フィードのIDに置き換え、リクエストボディの`tagId`は付けたいタグのIDを指定してください。

### 購読フィードからのタグ削除

購読フィードからタグを削除するには：

```bash
curl -X DELETE https://api.example.com/api/v1/tags/subscriptions/{subscriptionId}?tagId={tagId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

`{subscriptionId}`はタグを削除したい購読フィードのID、`{tagId}`は削除したいタグのIDに置き換えてください。

## お気に入り管理

お気に入り機能を使用すると、重要なフィード記事をマークして後で簡単にアクセスできます。

### お気に入り一覧の取得

お気に入りに登録したすべてのフィード記事を取得するには：

```bash
curl -X GET https://api.example.com/api/v1/favorites \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### お気に入りステータスの確認

特定のフィード記事がお気に入りに登録されているかを確認するには：

```bash
curl -X GET https://api.example.com/api/v1/favorites/{feedItemId}/is-favorited \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

`{feedItemId}`は確認したいフィード記事のIDに置き換えてください。

### お気に入りへの追加

フィード記事をお気に入りに追加するには：

```bash
curl -X POST https://api.example.com/api/v1/favorites/{feedItemId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

`{feedItemId}`はお気に入りに追加したいフィード記事のIDに置き換えてください。

### お気に入りからの削除

フィード記事をお気に入りから削除するには：

```bash
curl -X DELETE https://api.example.com/api/v1/favorites/{feedItemId} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

`{feedItemId}`はお気に入りから削除したいフィード記事のIDに置き換えてください。

## タグとお気に入りの活用例

### 効率的な情報管理

- **業界別タグ**: 技術、ビジネス、健康などの大カテゴリでタグ付け
- **優先度タグ**: 「今すぐ読む」「あとで読む」などのタグで優先順位付け
- **プロジェクトタグ**: 特定のプロジェクトに関連する記事をグループ化

### お気に入りの活用

- 後で参照したい重要な記事の保存
- 定期的に見直したい参考資料の整理
- 共有したい興味深い記事の一時保管

## 関連情報

- [フィード管理](feed-management.md) - フィードの購読と管理方法
- [API リファレンス](../api/reference.md) - タグとお気に入り関連APIの詳細仕様