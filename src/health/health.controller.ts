import { InjectQueue } from '@nestjs/bull'
import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { JobCounts, Queue } from 'bull'
import Redis from 'ioredis'
import { SupabaseRequestService } from 'src/supabase-request.service'
import { HealthCheckResponseDto } from './dto/health-check-response.dto'

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
        @InjectQueue('feedQueue') private readonly feedQueue: Queue,
        @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    ) {}

    @ApiOperation({ summary: 'Check system health' })
    @ApiResponse({
        status: 200,
        description: 'System is healthy',
        type: HealthCheckResponseDto,
    })
    @ApiResponse({ status: 503, description: 'Service unavailable' })
    @Get()
    async checkHealth(): Promise<HealthCheckResponseDto> {
        try {
            // DB接続チェック
            const supabase = this.supabaseRequestService.getClient()
            const { error: dbError } = await supabase
                .from('users')
                .select('id')
                .limit(1)
            if (dbError) {
                throw new Error(`Database check failed: ${dbError.message}`)
            }

            // Redis接続チェック
            let redisStatus = 'OK'
            try {
                const pingResult = await this.redisClient.ping()
                if (pingResult !== 'PONG') {
                    throw new Error(`Unexpected PING result: ${pingResult}`)
                }
            } catch (redisError) {
                redisStatus = `NG: ${
                    redisError instanceof Error ? redisError.message : redisError
                }`
            }
            if (redisStatus !== 'OK') {
                throw new Error(`Redis check failed: ${redisStatus}`)
            }

            // Bull Queue接続チェック
            let bullStatus: string
            let jobCounts: JobCounts = {
                waiting: 0,
                active: 0,
                completed: 0,
                failed: 0,
                delayed: 0,
            }
            try {
                await this.feedQueue.isReady()
                jobCounts = await this.feedQueue.getJobCounts()
                bullStatus = 'OK'
            } catch (bullError) {
                bullStatus = `NG: ${
                    bullError instanceof Error ? bullError.message : bullError
                }`
            }
            if (bullStatus !== 'OK') {
                throw new Error(`Bull Queue check failed: ${bullStatus}`)
            }

            // 全てOKならレスポンスを返す
            return {
                status: 'OK',
                db: 'OK',
                bullQueue: {
                    status: bullStatus,
                    jobCounts,
                },
                redis: redisStatus,
            }
        } catch (err) {
            throw new HttpException(
                `Health check failed: ${err instanceof Error ? err.message : err}`,
                HttpStatus.SERVICE_UNAVAILABLE,
            )
        }
    }
}