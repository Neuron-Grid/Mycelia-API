import { TypedBody, TypedRoute } from "@nestia/core";
import { Controller, UseGuards } from "@nestjs/common";
import type { User } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import {
    buildResponse,
    type SuccessResponse,
} from "@/common/utils/response.util";
import { SupabaseUser } from "../../auth/supabase-user.decorator";
import type {
    PodcastConfigResponseDto,
    UpdatePodcastConfigDto,
} from "./dto/podcast-config.dto";
import { PodcastConfigService } from "./podcast-config.service";

@Controller("podcast/config")
@UseGuards(SupabaseAuthGuard)
export class PodcastConfigController {
    constructor(private readonly podcastConfigService: PodcastConfigService) {}

    /** Get podcast settings */
    @TypedRoute.Get("")
    async getPodcastConfig(
        @SupabaseUser() user: User,
    ): Promise<SuccessResponse<PodcastConfigResponseDto>> {
        const dto = await this.podcastConfigService.getUserPodcastConfig(
            user.id,
        );
        return buildResponse("Podcast settings fetched", dto);
    }

    /** Update podcast settings */
    @TypedRoute.Put("")
    async updatePodcastConfig(
        @SupabaseUser() user: User,
        @TypedBody() updateDto: UpdatePodcastConfigDto,
    ): Promise<SuccessResponse<PodcastConfigResponseDto>> {
        const dto = await this.podcastConfigService.updatePodcastConfig(
            user.id,
            updateDto,
        );
        return buildResponse("Podcast settings updated", dto);
    }
}
