# フィード管理

RSS News APIを使用してRSSフィードを管理する方法について説明します。このガイドでは、フィードの購読、更新、削除、およびフィード記事の取得方法を解説します。

## フィードの購読管理

### フィード購読一覧の取得

現在購読中のすべてのRSSフィードを取得するには：

```bash
curl -X GET https://api.example.com/api/v1/feed/subscriptions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

成功した場合、現在のユーザーが購読しているすべてのフィードのリストが返されます。

### 新しいフィードの購読登録

新しいRSSフィードを購読するには：

```bash
curl -X POST https://api.example.com/api/v1/feed/subscriptions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "feedUrl": "https://example.com/rss.xml"
  }'
```

サーバーはフィードURLを検証し、有効なRSSフィードであれば購読を追加します。成功すると、新しく作成された購読情報が返されます。

### 購読情報の更新

購読しているフィードの情報（例：カスタムタイトル）を更新するには：

```bash
curl -X PATCH https://api.example.com/api/v1/feed/subscriptions/{id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "feed_title": "My Custom Feed Title"
  }'
```

`{id}`は更新する購読のIDに置き換えてください。

### 購読の削除

フィードの購読を解除するには：

```bash
curl -X DELETE https://api.example.com/api/v1/feed/subscriptions/{id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

`{id}`は削除する購読のIDに置き換えてください。

## フィード記事の取得

### 購読中フィードの記事一覧取得

特定の購読からフィード記事を取得するには：

```bash
curl -X GET https://api.example.com/api/v1/feed/subscriptions/{id}/items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

`{id}`は記事を取得したい購読のIDに置き換えてください。

### フィードの手動更新

購読中のフィードを手動で更新して最新の記事を取得するには：

```bash
curl -X POST https://api.example.com/api/v1/feed/subscriptions/{id}/fetch \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

`{id}`は更新したい購読のIDに置き換えてください。

## フィード管理のベストプラクティス

### 適切なフィード更新間隔の設定

フィードの更新頻度は、リソース消費と最新情報の入手のバランスを考慮して設定してください。多くのRSSフィードは1時間に1回程度の更新が適切です。

### エラー処理

フィードURLが無効になったり、サーバーが応答しなくなったりする場合があります。定期的にフィードのステータスを確認し、問題がある場合は対処してください。

### リソース管理

多数のフィードを購読する場合は、実際に閲覧する予定のあるフィードのみを購読することをお勧めします。不要になったフィードは定期的に購読解除して、システムリソースを効率的に使用してください。

## 関連情報

- [タグとお気に入り](tags-favorites.md) - フィード記事の整理方法
- [API リファレンス](../api/reference.md) - フィード関連APIの詳細仕様