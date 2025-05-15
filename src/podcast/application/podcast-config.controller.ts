import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { User } from '@supabase/supabase-js'
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard'
import { SupabaseUser } from '../../auth/supabase-user.decorator'
import { PodcastConfigResponseDto, UpdatePodcastConfigDto } from './dto/podcast-config.dto'
import { PodcastConfigService } from './podcast-config.service'

@ApiTags('podcast')
@Controller('podcast/config')
@UseGuards(SupabaseAuthGuard)
export class PodcastConfigController {
    constructor(private readonly podcastConfigService: PodcastConfigService) {}

    @Get()
    @ApiOperation({ summary: 'ポッドキャスト設定を取得' })
    @ApiResponse({
        status: 200,
        description: 'ポッドキャスト設定',
        type: PodcastConfigResponseDto,
    })
    async getPodcastConfig(@SupabaseUser() user: User): Promise<PodcastConfigResponseDto> {
        return await this.podcastConfigService.getUserPodcastConfig(user.id)
    }

    @Put()
    @ApiOperation({ summary: 'ポッドキャスト設定を更新' })
    @ApiResponse({
        status: 200,
        description: '更新されたポッドキャスト設定',
        type: PodcastConfigResponseDto,
    })
    async updatePodcastConfig(
        @SupabaseUser() user: User,
        @Body() updateDto: UpdatePodcastConfigDto,
    ): Promise<PodcastConfigResponseDto> {
        return await this.podcastConfigService.updatePodcastConfig(user.id, updateDto)
    }
}
