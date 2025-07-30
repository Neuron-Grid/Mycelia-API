import { Injectable, Logger } from "@nestjs/common";
import { SupabaseRequestService } from "src/supabase-request.service";
import { Database } from "src/types/schema";

// feed_item_favoritesテーブル
type FavoritesTable = Database["public"]["Tables"]["feed_item_favorites"];
type FavoritesRow = FavoritesTable["Row"];
type FavoritesInsert = FavoritesTable["Insert"];

@Injectable()
export class FavoriteRepository {
    private readonly logger = new Logger(FavoriteRepository.name);

    constructor(private readonly supabaseService: SupabaseRequestService) {}

    // 指定ユーザーのお気に入り一覧を取得
    async findAllByUserId(userId: string): Promise<FavoritesRow[]> {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("feed_item_favorites")
            .select("*")
            .eq("user_id", userId)
            .eq("soft_deleted", false)
            .order("created_at", { ascending: false });

        if (error) {
            this.logger.error(
                `findAllByUserId failed: ${error.message}`,
                error,
            );
            throw error;
        }
        return data ?? [];
    }

    // お気に入り登録
    async addFavorite(
        userId: string,
        feedItemId: number,
    ): Promise<FavoritesRow> {
        const supabase = this.supabaseService.getClient();
        const insertData: FavoritesInsert = {
            user_id: userId,
            feed_item_id: feedItemId,
        };
        const { data, error } = await supabase
            .from("feed_item_favorites")
            .insert(insertData)
            .select()
            .single();

        if (error) {
            this.logger.error(`addFavorite failed: ${error.message}`, error);
            throw error;
        }
        return data;
    }

    // お気に入り解除
    async removeFavorite(userId: string, feedItemId: number): Promise<void> {
        const supabase = this.supabaseService.getClient();
        const { error } = await supabase
            .from("feed_item_favorites")
            .delete()
            .eq("user_id", userId)
            .eq("feed_item_id", feedItemId);

        if (error) {
            this.logger.error(`removeFavorite failed: ${error.message}`, error);
            throw error;
        }
    }

    // 既にお気に入りかを確認
    async isFavorited(userId: string, feedItemId: number): Promise<boolean> {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("feed_item_favorites")
            .select("id")
            .eq("user_id", userId)
            .eq("feed_item_id", feedItemId)
            .single();

        if (error && error.code !== "PGRST116") {
            // 'PGRST116' => 'Row not found' (PostgRESTでsingle()時)
            this.logger.error(
                `isFavorited check failed: ${error.message}`,
                error,
            );
            throw error;
        }
        return !!data;
    }

    // 複数のフィードアイテムIDに対してお気に入り情報を一括取得
    async findFavoritesByFeedItemIds(
        userId: string,
        feedItemIds: number[],
    ): Promise<FavoritesRow[]> {
        if (feedItemIds.length === 0) {
            return [];
        }

        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
            .from("feed_item_favorites")
            .select("*")
            .eq("user_id", userId)
            .in("feed_item_id", feedItemIds)
            .eq("soft_deleted", false);

        if (error) {
            this.logger.error(
                `findFavoritesByFeedItemIds failed: ${error.message}`,
                error,
            );
            throw error;
        }
        return data ?? [];
    }
}
