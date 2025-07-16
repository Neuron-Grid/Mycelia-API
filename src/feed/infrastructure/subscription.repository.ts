import { Injectable, Logger } from '@nestjs/common';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { SupabaseRequestService } from 'src/supabase-request.service';
import { Database } from 'src/types/schema';

type Row = Database['public']['Tables']['user_subscriptions']['Row'];
type Update = Database['public']['Tables']['user_subscriptions']['Update'];

@Injectable()
export class SubscriptionRepository {
    private readonly logger = new Logger(SubscriptionRepository.name);
    constructor(private readonly sbReq: SupabaseRequestService) {}

    // ページネーション付き取得
    async findByUserIdPaginated(
        userId: string,
        page: number,
        limit: number,
    ): Promise<PaginatedResult<Row>> {
        const sb = this.sbReq.getClient();
        const offset = (page - 1) * limit;

        const { data, error, count } = await sb
            .from('user_subscriptions')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('id', { ascending: true })
            .range(offset, offset + limit - 1);

        if (error) {
            this.logger.error(`findByUserIdPaginated: ${error.message}`, error);
            throw error;
        }

        const retrieved = data ?? [];
        const total = count ?? 0;

        return {
            data: retrieved,
            total,
            page,
            limit,
            hasNext: total > offset + retrieved.length,
        };
    }

    // 複合PK(id, user_id)で1件取得。
    // 存在しなければnull
    async findOne(subId: number, userId: string): Promise<Row | null> {
        const sb = this.sbReq.getClient();
        const { data, error } = await sb
            .from('user_subscriptions')
            .select('*')
            .eq('id', subId)
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            this.logger.error(`findOne: ${error.message}`, error);
            throw error;
        }
        if (error && error.code === 'PGRST116') return null;
        return data;
    }

    // next_fetch_atが期日以内のレコードを取得
    // 昇順ソート
    // 注意: システム全体のスケジューリング用のため、全ユーザーのデータを取得します
    async findDueSubscriptions(cutoff: Date): Promise<Row[]> {
        const sb = this.sbReq.getClient();
        const { data, error } = await sb
            .from('user_subscriptions')
            .select('*')
            .lte('next_fetch_at', cutoff.toISOString())
            .order('next_fetch_at', { ascending: true });

        if (error) {
            this.logger.error(`findDueSubscriptions: ${error.message}`, error);
            throw error;
        }
        return data ?? [];
    }

    // ユーザー固有の期限到達サブスクリプション取得（ユーザー分離版）
    async findDueSubscriptionsByUser(userId: string, cutoff: Date): Promise<Row[]> {
        const sb = this.sbReq.getClient();
        const { data, error } = await sb
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId) // ユーザー分離の保証
            .lte('next_fetch_at', cutoff.toISOString())
            .order('next_fetch_at', { ascending: true });

        if (error) {
            this.logger.error(`findDueSubscriptionsByUser: ${error.message}`, error);
            throw error;
        }
        return data ?? [];
    }

    // 新しい購読を追加
    // next_fetch_atはDBトリガで自動計算
    async insertSubscription(userId: string, feedUrl: string, feedTitle: string): Promise<Row> {
        const sb = this.sbReq.getClient();
        const { data, error } = await sb
            .from('user_subscriptions')
            .insert({
                user_id: userId,
                feed_url: feedUrl,
                feed_title: feedTitle,
            })
            .select()
            .single();

        if (error) {
            this.logger.error(`insertSubscription: ${error.message}`, error);
            throw error;
        }
        return data;
    }

    // last_fetched_atのみ更新
    // next_fetch_at は trigger で再計算
    async updateLastFetched(subId: number, userId: string, lastFetchedAt: Date): Promise<void> {
        const sb = this.sbReq.getClient();
        const patch: Update = { last_fetched_at: lastFetchedAt.toISOString() };

        const { error } = await sb
            .from('user_subscriptions')
            .update(patch)
            .eq('id', subId)
            .eq('user_id', userId);

        if (error) {
            this.logger.error(`updateLastFetched: ${error.message}`, error);
            throw error;
        }
    }

    // feed_titleを部分更新
    async updateSubscriptionTitle(subId: number, userId: string, newTitle?: string): Promise<Row> {
        const sb = this.sbReq.getClient();
        const updateData: Update = {};
        if (typeof newTitle !== 'undefined') updateData.feed_title = newTitle;

        const { data, error } = await sb
            .from('user_subscriptions')
            .update(updateData)
            .eq('id', subId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            this.logger.error(`updateSubscriptionTitle: ${error.message}`, error);
            throw error;
        }
        return data;
    }

    // 購読を削除
    async deleteSubscription(subId: number, userId: string): Promise<void> {
        const sb = this.sbReq.getClient();
        const { error } = await sb
            .from('user_subscriptions')
            .delete()
            .eq('id', subId)
            .eq('user_id', userId);

        if (error) {
            this.logger.error(`deleteSubscription: ${error.message}`, error);
            throw error;
        }
    }
}
