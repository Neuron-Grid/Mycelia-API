// 必要に応じて、TypeScriptの型定義やクラスを置く
// 今回は簡易的な例を示します

export class FeedItemEntity {
    id!: number
    user_subscription_id!: number
    user_id!: string
    title!: string
    link!: string
    description!: string
    published_at!: Date | null
    created_at!: Date
    updated_at!: Date
}
