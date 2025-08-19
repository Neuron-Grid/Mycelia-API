import { Module } from "@nestjs/common";
import { FavoriteRepository } from "src/favorite/infrastructure/favorite.repository";
import { FeedQueueModule } from "src/feed/queue/feed-queue.module";
import { LlmModule } from "src/llm/llm.module";
import { PodcastQueueModule } from "src/podcast/queue/podcast-queue.module";
import { SupabaseAdminService } from "src/shared/supabase-admin.service";
import { SupabaseRequestModule } from "src/supabase-request.module";
import { TagRepository } from "src/tag/infrastructure/tag.repository";
import { EmbeddingModule } from "../embedding/embedding.module";
import { FavoriteModule } from "../favorite/favorite.module";
import { TagModule } from "../tag/tag.module";
import { FeedController } from "./application/feed.controller";
import { FeedFetchService } from "./application/feed-fetch.service";
import { FeedItemService } from "./application/feed-item.service";
import { FeedSchedulerService } from "./application/feed-scheduler.service";
import { FeedUseCaseService } from "./application/feed-usecase.service";
import { SubscriptionService } from "./application/subscription.service";
import { FeedItemRepository } from "./infrastructure/feed-item.repository";
import { SubscriptionRepository } from "./infrastructure/subscription.repository";

@Module({
    imports: [
        SupabaseRequestModule,
        EmbeddingModule,
        FavoriteModule,
        TagModule,
        // for @InjectQueue("feedQueue")
        FeedQueueModule,
        // for @InjectQueue("summary-generate")
        LlmModule,
        // for @InjectQueue("podcastQueue")
        PodcastQueueModule,
    ],
    controllers: [FeedController],
    providers: [
        FeedFetchService,
        FeedItemService,
        FeedSchedulerService,
        FeedUseCaseService,
        SubscriptionService,
        FeedItemRepository,
        SubscriptionRepository,
        FavoriteRepository,
        TagRepository,
        SupabaseAdminService,
    ],
})
export class FeedModule {}
