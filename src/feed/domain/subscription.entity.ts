export class SubscriptionEntity {
    id!: number;
    user_id!: string;
    feed_url!: string;
    feed_title!: string | null;
    last_fetched_at!: Date | null;
    next_fetch_at!: Date | null;
    soft_deleted!: boolean;
    created_at!: Date;
    updated_at!: Date;
}
