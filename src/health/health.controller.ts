import { InjectQueue } from '@nestjs/bullmq'
import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Queue } from 'bullmq'
import { RedisService } from 'src/shared/redis/redis.service'
import { SupabaseRequestService } from 'src/supabase-request.service'
import { HealthCheckResponseDto, JobCountsDto } from './dto/health-check-response.dto'

// BullMQ の戻り値用
// Swagger DTOとは別物
type RawJobCounts = Awaited<ReturnType<Queue['getJobCounts']>>

@ApiTags('Health')
@Controller('health')
export class HealthController {
    // タイムアウト時間
    // 5000ms = 5秒
    private readonly TIMEOUT_MS = 5000

    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
        @InjectQueue('feedQueue') private readonly feedQueue: Queue,
        private readonly redisService: RedisService,
    ) {}

    // ROUTE
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
            await this.checkDatabaseWithTimeout()
            await this.checkRedisWithTimeout()
            const { bullStatus, jobCounts } = await this.checkBullQueueWithTimeout()

            return {
                status: 'OK',
                db: 'OK',
                bullQueue: {
                    status: bullStatus,
                    jobCounts,
                },
                redis: 'OK',
            }
        } catch (err) {
            throw new HttpException(
                `Health check failed: ${err instanceof Error ? err.message : err}`,
                HttpStatus.SERVICE_UNAVAILABLE,
            )
        }
    }

    // INDIVIDUAL CHECKS
    private async checkDatabaseWithTimeout(): Promise<void> {
        const supabase = this.supabaseRequestService.getClient()

        await this.withTimeout(
            (async () => {
                const { error } = await supabase.from('users').select('id').limit(1)
                if (error) throw new Error(`Database check failed: ${error.message}`)
            })(),
            this.TIMEOUT_MS,
        )
    }

    private async checkRedisWithTimeout(): Promise<void> {
        await this.withTimeout(
            (async () => {
                const redisClient = this.redisService.createMainClient()
                const pingResult = await redisClient.ping()
                if (pingResult !== 'PONG') {
                    throw new Error(`Unexpected PING result: ${pingResult}`)
                }
            })(),
            this.TIMEOUT_MS,
        )
    }

    private async checkBullQueueWithTimeout(): Promise<{
        bullStatus: string
        jobCounts: JobCountsDto
    }> {
        // DTOと同じキーを持つ初期値
        let jobCounts: JobCountsDto = {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
        }

        await this.withTimeout(
            (async () => {
                await this.feedQueue.waitUntilReady()
                const counts: RawJobCounts = await this.feedQueue.getJobCounts()

                jobCounts = {
                    waiting: counts.waiting ?? 0,
                    active: counts.active ?? 0,
                    completed: counts.completed ?? 0,
                    failed: counts.failed ?? 0,
                    delayed: counts.delayed ?? 0,
                }
            })(),
            this.TIMEOUT_MS,
        )

        return {
            bullStatus: 'OK',
            jobCounts,
        }
    }

    // UTILITY: TIMEOUT
    private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)

            promise
                .then((res) => {
                    clearTimeout(timer)
                    resolve(res)
                })
                .catch((err) => {
                    clearTimeout(timer)
                    reject(err)
                })
        })
    }
}
