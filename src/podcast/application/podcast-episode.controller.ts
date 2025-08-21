import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpException,
    HttpStatus,
    Logger,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Query,
    UseGuards,
} from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { UserId } from "../../auth/user-id.decorator";
import { DailySummaryRepository } from "../../llm/infrastructure/repositories/daily-summary.repository";
import { PodcastEpisodeRepository } from "../infrastructure/podcast-episode.repository";
import { PodcastQueueService } from "../queue/podcast-queue.service";
import {
    CreatePodcastEpisodeDto,
    GeneratePodcastEpisodeDto,
    PodcastEpisodeListResponseDto,
    PodcastEpisodeResponseDto,
    PodcastGenerationJobResponseDto,
    UpdatePodcastEpisodeDto,
} from "./dto/podcast-episode.dto";
import { PodcastEpisodeMapper } from "./podcast-episode.mapper";

@ApiTags("Podcast Episodes")
@Controller("podcast-episodes")
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class PodcastEpisodeController {
    private readonly logger = new Logger(PodcastEpisodeController.name);

    constructor(
        private readonly podcastEpisodeRepository: PodcastEpisodeRepository,
        private readonly dailySummaryRepository: DailySummaryRepository,
        private readonly podcastQueueService: PodcastQueueService,
        private readonly podcastEpisodeMapper: PodcastEpisodeMapper,
    ) {}

    @Get()
    @ApiOperation({ summary: "Get user podcast episodes with pagination" })
    @ApiQuery({
        name: "page",
        description: "Page number (1-based)",
        required: false,
        type: Number,
        example: 1,
    })
    @ApiQuery({
        name: "limit",
        description: "Number of episodes per page",
        required: false,
        type: Number,
        example: 20,
    })
    @ApiResponse({
        status: 200,
        description: "User podcast episodes retrieved successfully",
        type: PodcastEpisodeListResponseDto,
    })
    async getEpisodes(
        @UserId() userId: string,
        @Query("page") page = 1,
        @Query("limit") limit = 20,
    ): Promise<PodcastEpisodeListResponseDto> {
        // パラメータの検証
        const validPage = Math.max(1, Number(page));
        const validLimit = Math.min(Math.max(1, Number(limit)), 100); // 最大100件
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

        return {
            episodes: episodes.map((episode) =>
                this.podcastEpisodeMapper.toResponseDto(episode),
            ),
            total,
            page: validPage,
            limit: validLimit,
            total_pages: totalPages,
        };
    }

    @Get(":id")
    @ApiOperation({ summary: "Get a specific podcast episode by ID" })
    @ApiParam({
        name: "id",
        description: "Podcast episode ID",
        type: Number,
    })
    @ApiResponse({
        status: 200,
        description: "Podcast episode retrieved successfully",
        type: PodcastEpisodeResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: "Podcast episode not found or access denied",
    })
    async getEpisodeById(
        @UserId() userId: string,
        @Param("id", ParseIntPipe) episodeId: number,
    ): Promise<PodcastEpisodeResponseDto> {
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

        return this.podcastEpisodeMapper.toResponseDto(episode);
    }

    @Post()
    @ApiOperation({ summary: "Create a new podcast episode" })
    @ApiResponse({
        status: 201,
        description: "Podcast episode created successfully",
        type: PodcastEpisodeResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: "Invalid request data",
    })
    @ApiResponse({
        status: 404,
        description: "Related summary not found or access denied",
    })
    async createEpisode(
        @UserId() userId: string,
        @Body() createDto: CreatePodcastEpisodeDto,
    ): Promise<PodcastEpisodeResponseDto> {
        this.logger.log(
            `User ${userId} creating episode for summary ${createDto.summary_id}`,
        );

        // 要約の所有者チェック
        const summary = await this.dailySummaryRepository.findById(
            createDto.summary_id,
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
                createDto.summary_id,
            );
        if (existingEpisode) {
            throw new HttpException(
                "Podcast episode already exists for this summary",
                HttpStatus.CONFLICT,
            );
        }

        const episode = await this.podcastEpisodeRepository.create(
            userId,
            createDto.summary_id,
            {
                title: createDto.title,
            },
        );

        this.logger.log(`Episode ${episode.id} created for user ${userId}`);
        return this.podcastEpisodeMapper.toResponseDto(episode);
    }

    @Put(":id")
    @ApiOperation({ summary: "Update a podcast episode" })
    @ApiParam({
        name: "id",
        description: "Podcast episode ID",
        type: Number,
    })
    @ApiResponse({
        status: 200,
        description: "Podcast episode updated successfully",
        type: PodcastEpisodeResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: "Podcast episode not found or access denied",
    })
    async updateEpisode(
        @UserId() userId: string,
        @Param("id", ParseIntPipe) episodeId: number,
        @Body() updateDto: UpdatePodcastEpisodeDto,
    ): Promise<PodcastEpisodeResponseDto> {
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
        return this.podcastEpisodeMapper.toResponseDto(updatedEpisode);
    }

    @Delete(":id")
    @ApiOperation({ summary: "Soft delete a podcast episode" })
    @ApiParam({
        name: "id",
        description: "Podcast episode ID",
        type: Number,
    })
    @ApiResponse({
        status: 204,
        description: "Podcast episode deleted successfully",
    })
    @ApiResponse({
        status: 404,
        description: "Podcast episode not found or access denied",
    })
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteEpisode(
        @UserId() userId: string,
        @Param("id", ParseIntPipe) episodeId: number,
    ): Promise<void> {
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
    }

    @Post("generate")
    @ApiOperation({ summary: "Generate a new podcast episode from a summary" })
    @ApiResponse({
        status: 202,
        description: "Podcast generation job queued successfully",
        type: PodcastGenerationJobResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: "Invalid request data",
    })
    @ApiResponse({
        status: 404,
        description: "Related summary not found or access denied",
    })
    @HttpCode(HttpStatus.ACCEPTED)
    async generateEpisode(
        @UserId() userId: string,
        @Body() generateDto: GeneratePodcastEpisodeDto,
    ): Promise<PodcastGenerationJobResponseDto> {
        this.logger.log(
            `User ${userId} requesting podcast generation for summary ${generateDto.summary_id}`,
        );

        // 要約の所有者チェック
        const summary = await this.dailySummaryRepository.findById(
            generateDto.summary_id,
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
            generateDto.summary_id,
        );

        if (!episode) {
            episode = await this.podcastEpisodeRepository.create(
                userId,
                generateDto.summary_id,
                {
                    title:
                        summary.summary_title ||
                        `Podcast Episode - ${summary.summary_date}`,
                },
            );
            this.logger.log(
                `Created new episode ${episode.id} for summary ${generateDto.summary_id}`,
            );
        }

        // script_textの存在チェック
        if (!summary.script_text) {
            throw new BadRequestException(
                "Script text is required for podcast generation",
            );
        }

        // ポッドキャスト生成ジョブをキューに追加（新APIへ統一）
        const jobId = `podcast:${userId}:${generateDto.summary_id}`;
        await this.podcastQueueService.addGeneratePodcastJob(
            userId,
            generateDto.summary_id,
        );

        const message = `Podcast generation job queued for episode ID ${episode.id} (summary ID ${generateDto.summary_id})`;
        this.logger.log(message);

        return {
            message,
            job_id: jobId,
            episode_id: episode.id,
        };
    }
}
