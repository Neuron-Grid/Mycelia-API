import { Injectable, Logger } from "@nestjs/common";
import { SupabaseRequestService } from "src/supabase-request.service";

@Injectable()
export class MaintenanceService {
    private readonly logger = new Logger(MaintenanceService.name);

    constructor(private readonly supabase: SupabaseRequestService) {}

    // 週次のベクトルインデックス再構築（DB側にRPCが用意されている前提）
    async rebuildVectorIndexes(): Promise<void> {
        try {
            // 例: すべてのHNSWインデックス再構築を行うRPC
            const { error } = await this.supabase
                .getClient()
                .rpc("rebuild_all_vector_indexes");
            if (error) throw error;
            this.logger.log("Rebuilt all vector indexes via RPC");
        } catch (e) {
            this.logger.warn(
                `RPC 'rebuild_all_vector_indexes' failed: ${(e as Error).message}. Falling back to per-table refresh (if available).`,
            );
            // 必要に応じて、テーブル毎のRPCにフォールバック
            // 例: search_feed_items_by_vector_reindex など
        }
    }
}

