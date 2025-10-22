import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { EmbeddingController } from "./embedding.controller";
import { EmbeddingQueueModule } from "./queue/embedding-queue.module";

@Module({
    imports: [EmbeddingQueueModule, AuthModule],
    controllers: [EmbeddingController],
    exports: [EmbeddingQueueModule],
})
export class EmbeddingModule {}
