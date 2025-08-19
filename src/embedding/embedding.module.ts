import { Module } from "@nestjs/common";
import { SupabaseAdminService } from "src/shared/supabase-admin.service";
import { EmbeddingController } from "./embedding.controller";
import { EmbeddingQueueModule } from "./queue/embedding-queue.module";

@Module({
    imports: [EmbeddingQueueModule],
    controllers: [EmbeddingController],
    providers: [SupabaseAdminService],
    exports: [EmbeddingQueueModule],
})
export class EmbeddingModule {}
