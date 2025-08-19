import { Injectable, Logger } from "@nestjs/common";
import { SupabaseAdminService } from "src/shared/supabase-admin.service";

@Injectable()
export class MaintenanceService {
    private readonly logger = new Logger(MaintenanceService.name);

    constructor(private readonly admin: SupabaseAdminService) {}

    // 週次のベクトルインデックス再構築（アプローチB: 個別RPCを順次呼ぶ）
    async rebuildVectorIndexes(): Promise<void> {
        const targetIndexes = [
            "idx_feed_items_title_emb_hnsw",
            "idx_daily_summaries_summary_emb_hnsw",
            "idx_podcast_episodes_title_emb_hnsw",
            "idx_tags_tag_emb_hnsw",
        ];
        this.logger.log(
            `Starting weekly vector index rebuild for: ${targetIndexes.join(", ")}`,
        );

        // service-roleでのみEXECUTEがGRANTされているため、adminクライアント必須
        const adminRpc = this.admin
            .getClient()
            .rpc.bind(this.admin.getClient()) as unknown as (
            fn: string,
            args?: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: unknown }>;

        let success = 0;
        for (const indexName of targetIndexes) {
            try {
                const { error } = await adminRpc("rebuild_vector_index", {
                    p_index_name: indexName,
                });

                if (error) {
                    throw new Error(
                        `RPC error: ${JSON.stringify(error, null, 2)}`,
                    );
                }

                this.logger.log(`Successfully rebuilt index '${indexName}'`);
                success++;
            } catch (e) {
                this.logger.error(
                    `Failed to rebuild index '${indexName}': ${(e as Error).message}`,
                );
                // 1つのインデックスで失敗しても、次のインデックスの処理を続ける
            }
        }
        if (success === 0) {
            throw new Error("All index rebuild operations failed");
        }
        this.logger.log(
            `Finished weekly vector index rebuild process. Success: ${success}/${targetIndexes.length}`,
        );
    }
}
