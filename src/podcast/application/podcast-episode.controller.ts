import { TypedBody, TypedParam, TypedQuery, TypedRoute } from "@nestia/core";
import {
    BadRequestException,
    Controller,
    HttpCode,
    HttpException,
    HttpStatus,
    Logger,
    UseGuards,
} from "@nestjs/common";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { buildResponse } from "@/common/utils/response.util";
import { parseUInt32 } from "@/common/utils/typed-param";
import { UserId } from "../../auth/user-id.decorator";
import { DailySummaryRepository } from "../../llm/infrastructure/repositories/daily-summary.repository";
import { PodcastEpisodeRepository } from "../infrastructure/podcast-episode.repository";
import { PodcastQueueService } from "../queue/podcast-queue.service";
import {
    CreatePodcastEpisodeDto,
    GeneratePodcastEpisodeDto,
    // removed unused imports for Swagger-only DTO references
    UpdatePodcastEpisodeDto,
} from "./dto/podcast-episode.dto";
import { PodcastEpisodeMapper } from "./podcast-episode.mapper";

@Controller("podcast-episodes")
@UseGuards(SupabaseAuthGuard)
export class PodcastEpisodeController {
    private readonly logger = new Logger(PodcastEpisodeController.name);

    constructor(
        private readonly podcastEpisodeRepository: PodcastEpisodeRepository,
        private readonly dailySummaryRepository: DailySummaryRepository,
        private readonly podcastQueueService: PodcastQueueService,
        private readonly podcastEpisodeMapper: PodcastEpisodeMapper,
    ) {}

    /** Get user podcast episodes with pagination */
    @TypedRoute.Get("")
    async getEpisodes(
        @UserId() userId: string,
        @TypedQuery<{ page?: number; limit?: number }>()
        q: { page?: number; limit?: number },
    ): Promise<
        import("@/common/utils/response.util").SuccessResponse<
            import("./dto/podcast-episode.dto").PodcastEpisodeListResponseDto
        >
    > {
        // パラメータの検証
        const validPage = Math.max(1, Number(q?.page ?? 1));
        const validLimit = Math.min(Math.max(1, Number(q?.limit ?? 20)), 100); // 最大100件
        const offset = (validPage - 1) * validLimit;

        this.logger.log(
            `User ${userId} requesting episodes: page=${validPage}, limit=${validLimit}`,
        );

        const { episodes, total } =
            await this.podcastEpisodeRepository.findByUser(
                userId,
                validLimit,
                offset,
            );

        const totalPages = Math.ceil(total / validLimit);

        return buildResponse("Episodes fetched", {
            episodes: episodes.map((episode) =>
                this.podcastEpisodeMapper.toResponseDto(episode),
            ),
            total,
            page: validPage,
            limit: validLimit,
            totalPages: totalPages,
        });
    }

    /** Get a specific podcast episode by ID */
    @TypedRoute.Get(":id")
    async getEpisodeById(
        @UserId() userId: string,
        @TypedParam("id", parseUInt32) episodeId: number,
    ): Promise<
        import("@/common/utils/response.util").SuccessResponse<
            import("./dto/podcast-episode.dto").PodcastEpisodeResponseDto
        >
    > {
        this.logger.log(`User ${userId} requesting episode ${episodeId}`);

        const episode = await this.podcastEpisodeRepository.findById(
            episodeId,
            userId,
        );

        if (!episode) {
            throw new HttpException(
                "Podcast episode not found or access denied",
                HttpStatus.NOT_FOUND,
            );
        }

        return buildResponse(
            "Episode fetched",
            this.podcastEpisodeMapper.toResponseDto(episode),
        );
    }

    /** Create a new podcast episode */
    @TypedRoute.Post("")
    async createEpisode(
        @UserId() userId: string,
        @TypedBody() createDto: CreatePodcastEpisodeDto,
    ): Promise<
        import("@/common/utils/response.util").SuccessResponse<
            import("./dto/podcast-episode.dto").PodcastEpisodeResponseDto
        >
    > {
        this.logger.log(
            `User ${userId} creating episode for summary ${createDto.summaryId}`,
        );

        // 要約の所有者チェック
        const summary = await this.dailySummaryRepository.findById(
            createDto.summaryId,
            userId,
        );
        if (!summary) {
            throw new HttpException(
                "Related summary not found or access denied",
                HttpStatus.NOT_FOUND,
            );
        }

        // 既存のエピソードがないかチェック
        const existingEpisode =
            await this.podcastEpisodeRepository.findBySummaryId(
                userId,
                createDto.summaryId,
            );
        if (existingEpisode) {
            throw new HttpException(
                "Podcast episode already exists for this summary",
                HttpStatus.CONFLICT,
            );
        }

        const episode = await this.podcastEpisodeRepository.create(
            userId,
            createDto.summaryId,
            {
                title: createDto.title,
            },
        );

        this.logger.log(`Episode ${episode.id} created for user ${userId}`);
        return buildResponse(
            "Episode created",
            this.podcastEpisodeMapper.toResponseDto(episode),
        );
    }

    /** Update a podcast episode */
    @TypedRoute.Put(":id")
    async updateEpisode(
        @UserId() userId: string,
        @TypedParam("id", parseUInt32) episodeId: number,
        @TypedBody() updateDto: UpdatePodcastEpisodeDto,
    ): Promise<
        import("@/common/utils/response.util").SuccessResponse<
            import("./dto/podcast-episode.dto").PodcastEpisodeResponseDto
        >
    > {
        this.logger.log(`User ${userId} updating episode ${episodeId}`);

        // 所有者チェック
        const existingEpisode = await this.podcastEpisodeRepository.findById(
            episodeId,
            userId,
        );
        if (!existingEpisode) {
            throw new HttpException(
                "Podcast episode not found or access denied",
                HttpStatus.NOT_FOUND,
            );
        }

        const updatedEpisode = await this.podcastEpisodeRepository.update(
            episodeId,
            userId,
            updateDto,
        );

        this.logger.log(`Episode ${episodeId} updated by user ${userId}`);
        return buildResponse(
            "Episode updated",
            this.podcastEpisodeMapper.toResponseDto(updatedEpisode),
        );
    }

    /** Soft delete a podcast episode */
    @TypedRoute.Delete(":id")
    async deleteEpisode(
        @UserId() userId: string,
        @TypedParam("id", parseUInt32) episodeId: number,
    ): Promise<import("@/common/utils/response.util").SuccessResponse<null>> {
        this.logger.log(`User ${userId} deleting episode ${episodeId}`);

        // 所有者チェック
        const existingEpisode = await this.podcastEpisodeRepository.findById(
            episodeId,
            userId,
        );
        if (!existingEpisode) {
            throw new HttpException(
                "Podcast episode not found or access denied",
                HttpStatus.NOT_FOUND,
            );
        }

        await this.podcastEpisodeRepository.softDelete(episodeId, userId);
        this.logger.log(`Episode ${episodeId} deleted by user ${userId}`);
        return buildResponse("Episode deleted", null);
    }

    /** Generate a new podcast episode from a summary */
    @TypedRoute.Post("generate")
    @HttpCode(HttpStatus.ACCEPTED)
    async generateEpisode(
        @UserId() userId: string,
        @TypedBody() generateDto: GeneratePodcastEpisodeDto,
    ): Promise<
        import("@/common/utils/response.util").SuccessResponse<{
            jobId?: string;
            episodeId?: number;
        }>
    > {
        this.logger.log(
            `User ${userId} requesting podcast generation for summary ${generateDto.summaryId}`,
        );

        // 要約の所有者チェック
        const summary = await this.dailySummaryRepository.findById(
            generateDto.summaryId,
            userId,
        );
        if (!summary) {
            throw new HttpException(
                "Related summary not found or access denied",
                HttpStatus.NOT_FOUND,
            );
        }

        // 要約にスクリプトが存在するかチェック
        if (!summary.hasScript()) {
            throw new HttpException(
                "Summary script is required for podcast generation",
                HttpStatus.BAD_REQUEST,
            );
        }

        // 既存のエピソードがあるかチェックし、なければ作成
        let episode = await this.podcastEpisodeRepository.findBySummaryId(
            userId,
            generateDto.summaryId,
        );

        if (!episode) {
            episode = await this.podcastEpisodeRepository.create(
                userId,
                generateDto.summaryId,
                {
                    title:
                        summary.summary_title ||
                        `Podcast Episode - ${summary.summary_date}`,
                },
            );
            this.logger.log(
                `Created new episode ${episode.id} for summary ${generateDto.summaryId}`,
            );
        }

        // script_textの存在チェック
        if (!summary.script_text) {
            throw new BadRequestException(
                "Script text is required for podcast generation",
            );
        }

        // ポッドキャスト生成ジョブをキューに追加（新APIへ統一）
        const jobId = `podcast:${userId}:${generateDto.summaryId}`;
        await this.podcastQueueService.addGeneratePodcastJob(
            userId,
            generateDto.summaryId,
        );

        const message = `Podcast generation job queued for episode ID ${episode.id} (summary ID ${generateDto.summaryId})`;
        this.logger.log(message);

        return buildResponse("Podcast job queued", {
            jobId: jobId,
            episodeId: episode.id,
        });
    }
}
