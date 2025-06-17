import {
    Body,
    Controller,
    Delete,
    Get,
    HttpException,
    HttpStatus,
    Logger,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common'
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger'
import { User as SupabaseUserType } from '@supabase/supabase-js'
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard'
import { SupabaseUser } from '../../auth/supabase-user.decorator'
import { DailySummaryRepository } from '../../llm/infrastructure/daily-summary.repository'
import { PodcastEpisodeEntity } from '../domain/podcast-episode.entity'
import { PodcastEpisodeRepository } from '../infrastructure/podcast-episode.repository'
import { PodcastQueueService } from '../queue/podcast-queue.service'
import {
    CreatePodcastEpisodeDto,
    GeneratePodcastEpisodeDto,
    PodcastEpisodeListResponseDto,
    PodcastEpisodeResponseDto,
    PodcastGenerationJobResponseDto,
    UpdatePodcastEpisodeDto,
} from './dto/podcast-episode.dto'
import { PodcastEpisodeMapper } from './podcast-episode.mapper'

@ApiTags('Podcast Episodes')
@Controller('api/v1/podcast-episodes')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class PodcastEpisodeController {
    private readonly logger = new Logger(PodcastEpisodeController.name)

    constructor(
        private readonly podcastEpisodeRepository: PodcastEpisodeRepository,
        private readonly dailySummaryRepository: DailySummaryRepository,
        private readonly podcastQueueService: PodcastQueueService,
        private readonly podcastEpisodeMapper: PodcastEpisodeMapper,
    ) {}

    @Get()
    @ApiOperation({ summary: 'Get user podcast episodes with pagination' })
    @ApiQuery({
        name: 'page',
        description: 'Page number (1-based)',
        required: false,
        type: Number,
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        description: 'Number of episodes per page',
        required: false,
        type: Number,
        example: 20,
    })
    @ApiResponse({
        status: 200,
        description: 'User podcast episodes retrieved successfully',
        type: PodcastEpisodeListResponseDto,
    })
    async getEpisodes(
        @SupabaseUser() user: SupabaseUserType,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ): Promise<PodcastEpisodeListResponseDto> {
        if (!user?.id) {
            throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED)
        }

        // パラメータの検証
        const validPage = Math.max(1, Number(page))
        const validLimit = Math.min(Math.max(1, Number(limit)), 100) // 最大100件
        const offset = (validPage - 1) * validLimit

        this.logger.log(
            `User ${user.id} requesting episodes: page=${validPage}, limit=${validLimit}`,
        )

        try {
            const { episodes, total } = await this.podcastEpisodeRepository.findByUser(
                user.id,
                validLimit,
                offset,
            )

            const totalPages = Math.ceil(total / validLimit)

            return {
                episodes: episodes.map((episode) =>
                    this.podcastEpisodeMapper.toResponseDto(episode),
                ),
                total,
                page: validPage,
                limit: validLimit,
                total_pages: totalPages,
            }
        } catch (error) {
            this.logger.error(`Failed to get episodes for user ${user.id}: ${error.message}`)
            throw new HttpException('Failed to retrieve episodes', HttpStatus.INTERNAL_SERVER_ERROR)
        }
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific podcast episode by ID' })
    @ApiParam({
        name: 'id',
        description: 'Podcast episode ID',
        type: Number,
    })
    @ApiResponse({
        status: 200,
        description: 'Podcast episode retrieved successfully',
        type: PodcastEpisodeResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Podcast episode not found or access denied',
    })
    async getEpisodeById(
        @SupabaseUser() user: SupabaseUserType,
        @Param('id', ParseIntPipe) episodeId: number,
    ): Promise<PodcastEpisodeResponseDto> {
        if (!user?.id) {
            throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED)
        }

        this.logger.log(`User ${user.id} requesting episode ${episodeId}`)

        const episode = await this.podcastEpisodeRepository.findById(episodeId, user.id)

        if (!episode) {
            throw new HttpException(
                'Podcast episode not found or access denied',
                HttpStatus.NOT_FOUND,
            )
        }

        return this.podcastEpisodeMapper.toResponseDto(episode)
    }

    @Post()
    @ApiOperation({ summary: 'Create a new podcast episode' })
    @ApiResponse({
        status: 201,
        description: 'Podcast episode created successfully',
        type: PodcastEpisodeResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid request data',
    })
    @ApiResponse({
        status: 404,
        description: 'Related summary not found or access denied',
    })
    async createEpisode(
        @SupabaseUser() user: SupabaseUserType,
        @Body() createDto: CreatePodcastEpisodeDto,
    ): Promise<PodcastEpisodeResponseDto> {
        if (!user?.id) {
            throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED)
        }

        this.logger.log(`User ${user.id} creating episode for summary ${createDto.summary_id}`)

        // 要約の所有者チェック
        const summary = await this.dailySummaryRepository.findById(createDto.summary_id, user.id)
        if (!summary) {
            throw new HttpException(
                'Related summary not found or access denied',
                HttpStatus.NOT_FOUND,
            )
        }

        // 既存のエピソードがないかチェック
        const existingEpisode = await this.podcastEpisodeRepository.findBySummaryId(
            user.id,
            createDto.summary_id,
        )
        if (existingEpisode) {
            throw new HttpException(
                'Podcast episode already exists for this summary',
                HttpStatus.CONFLICT,
            )
        }

        try {
            const episode = await this.podcastEpisodeRepository.create(
                user.id,
                createDto.summary_id,
                {
                    title: createDto.title,
                },
            )

            this.logger.log(`Episode ${episode.id} created for user ${user.id}`)
            return this.podcastEpisodeMapper.toResponseDto(episode)
        } catch (error) {
            this.logger.error(`Failed to create episode for user ${user.id}: ${error.message}`)
            throw new HttpException('Failed to create episode', HttpStatus.INTERNAL_SERVER_ERROR)
        }
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a podcast episode' })
    @ApiParam({
        name: 'id',
        description: 'Podcast episode ID',
        type: Number,
    })
    @ApiResponse({
        status: 200,
        description: 'Podcast episode updated successfully',
        type: PodcastEpisodeResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Podcast episode not found or access denied',
    })
    async updateEpisode(
        @SupabaseUser() user: SupabaseUserType,
        @Param('id', ParseIntPipe) episodeId: number,
        @Body() updateDto: UpdatePodcastEpisodeDto,
    ): Promise<PodcastEpisodeResponseDto> {
        if (!user?.id) {
            throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED)
        }

        this.logger.log(`User ${user.id} updating episode ${episodeId}`)

        // 所有者チェック
        const existingEpisode = await this.podcastEpisodeRepository.findById(episodeId, user.id)
        if (!existingEpisode) {
            throw new HttpException(
                'Podcast episode not found or access denied',
                HttpStatus.NOT_FOUND,
            )
        }

        try {
            const updatedEpisode = await this.podcastEpisodeRepository.update(
                episodeId,
                user.id,
                updateDto,
            )

            this.logger.log(`Episode ${episodeId} updated by user ${user.id}`)
            return this.podcastEpisodeMapper.toResponseDto(updatedEpisode)
        } catch (error) {
            this.logger.error(
                `Failed to update episode ${episodeId} for user ${user.id}: ${error.message}`,
            )
            throw new HttpException('Failed to update episode', HttpStatus.INTERNAL_SERVER_ERROR)
        }
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Soft delete a podcast episode' })
    @ApiParam({
        name: 'id',
        description: 'Podcast episode ID',
        type: Number,
    })
    @ApiResponse({
        status: 204,
        description: 'Podcast episode deleted successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'Podcast episode not found or access denied',
    })
    async deleteEpisode(
        @SupabaseUser() user: SupabaseUserType,
        @Param('id', ParseIntPipe) episodeId: number,
    ): Promise<void> {
        if (!user?.id) {
            throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED)
        }

        this.logger.log(`User ${user.id} deleting episode ${episodeId}`)

        // 所有者チェック
        const existingEpisode = await this.podcastEpisodeRepository.findById(episodeId, user.id)
        if (!existingEpisode) {
            throw new HttpException(
                'Podcast episode not found or access denied',
                HttpStatus.NOT_FOUND,
            )
        }

        try {
            await this.podcastEpisodeRepository.softDelete(episodeId, user.id)
            this.logger.log(`Episode ${episodeId} deleted by user ${user.id}`)
        } catch (error) {
            this.logger.error(
                `Failed to delete episode ${episodeId} for user ${user.id}: ${error.message}`,
            )
            throw new HttpException('Failed to delete episode', HttpStatus.INTERNAL_SERVER_ERROR)
        }
    }

    @Post('generate')
    @ApiOperation({ summary: 'Generate a new podcast episode from a summary' })
    @ApiResponse({
        status: 202,
        description: 'Podcast generation job queued successfully',
        type: PodcastGenerationJobResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid request data',
    })
    @ApiResponse({
        status: 404,
        description: 'Related summary not found or access denied',
    })
    async generateEpisode(
        @SupabaseUser() user: SupabaseUserType,
        @Body() generateDto: GeneratePodcastEpisodeDto,
    ): Promise<PodcastGenerationJobResponseDto> {
        if (!user?.id) {
            throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED)
        }

        this.logger.log(
            `User ${user.id} requesting podcast generation for summary ${generateDto.summary_id}`,
        )

        // 要約の所有者チェック
        const summary = await this.dailySummaryRepository.findById(generateDto.summary_id, user.id)
        if (!summary) {
            throw new HttpException(
                'Related summary not found or access denied',
                HttpStatus.NOT_FOUND,
            )
        }

        // 要約にスクリプトが存在するかチェック
        if (!summary.hasScript()) {
            throw new HttpException(
                'Summary script is required for podcast generation',
                HttpStatus.BAD_REQUEST,
            )
        }

        try {
            // 既存のエピソードがあるかチェックし、なければ作成
            let episode = await this.podcastEpisodeRepository.findBySummaryId(
                user.id,
                generateDto.summary_id,
            )

            if (!episode) {
                episode = await this.podcastEpisodeRepository.create(
                    user.id,
                    generateDto.summary_id,
                    {
                        title: summary.summary_title || `Podcast Episode - ${summary.summary_date}`,
                    },
                )
                this.logger.log(
                    `Created new episode ${episode.id} for summary ${generateDto.summary_id}`,
                )
            }

            // script_textの存在チェック
            if (!summary.script_text) {
                throw new BadRequestException('Script text is required for podcast generation')
            }

            // ポッドキャスト生成ジョブをキューに追加
            const result = await this.podcastQueueService.addPodcastJob(
                summary.script_text,
                user.id,
                'ja-JP', // デフォルト言語
                `episode-${episode.id}-${Date.now()}.opus`,
                episode.title || undefined,
            )

            const message = `Podcast generation job queued for episode ID ${episode.id} (summary ID ${generateDto.summary_id})`
            this.logger.log(message)

            return {
                message,
                job_id: result.filename, // ファイル名をジョブIDとして使用
                episode_id: episode.id,
            }
        } catch (error) {
            this.logger.error(
                `Failed to generate podcast for summary ${generateDto.summary_id}: ${error.message}`,
            )
            throw new HttpException(
                'Failed to queue podcast generation',
                HttpStatus.INTERNAL_SERVER_ERROR,
            )
        }
    }
}
