export class SubscriptionEntity {
    id!: number
    user_id!: string
    feed_url!: string
    feed_title!: string
    refresh_interval!: string
    last_fetched_at!: Date | null
    next_fetch_at!: Date | null
    created_at!: Date
    updated_at!: Date
}
