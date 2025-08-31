import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger";
import type { User } from "@supabase/supabase-js";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { ErrorResponseDto } from "@/common/dto/error-response.dto";
import { buildResponse } from "@/common/utils/response.util";
import { SupabaseUser } from "../../auth/supabase-user.decorator";
import type { UpdatePodcastConfigDto } from "./dto/podcast-config.dto";
import { PodcastConfigService } from "./podcast-config.service";

@ApiTags("podcast")
@Controller("podcast/config")
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class PodcastConfigController {
    constructor(private readonly podcastConfigService: PodcastConfigService) {}

    @Get()
    @ApiOperation({ summary: "Get podcast settings" })
    @ApiResponse({
        status: 200,
        description: "Returns { message, data: PodcastConfigResponseDto }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { $ref: "#/components/schemas/PodcastConfigResponseDto" },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    async getPodcastConfig(@SupabaseUser() user: User) {
        const dto = await this.podcastConfigService.getUserPodcastConfig(
            user.id,
        );
        return buildResponse("Podcast settings fetched", dto);
    }

    @Put()
    @ApiOperation({ summary: "Update podcast settings" })
    @ApiResponse({
        status: 200,
        description: "Returns { message, data: PodcastConfigResponseDto }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { $ref: "#/components/schemas/PodcastConfigResponseDto" },
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: "Bad Request",
        type: ErrorResponseDto,
    })
    @ApiResponse({
        status: 401,
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    async updatePodcastConfig(
        @SupabaseUser() user: User,
        @Body() updateDto: UpdatePodcastConfigDto,
    ) {
        const dto = await this.podcastConfigService.updatePodcastConfig(
            user.id,
            updateDto,
        );
        return buildResponse("Podcast settings updated", dto);
    }
}
