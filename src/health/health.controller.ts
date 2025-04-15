import { InjectQueue } from '@nestjs/bull'
import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { JobCounts, Queue } from 'bull'
import { RedisService } from 'src/shared/redis/redis.service'
import { SupabaseRequestService } from 'src/supabase-request.service'
import { HealthCheckResponseDto } from './dto/health-check-response.dto'

@ApiTags('Health')
@Controller('health')
export class HealthController {
    // タイムアウト値 (ms)
    private readonly TIMEOUT_MS = 5000

    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
        @InjectQueue('feedQueue') private readonly feedQueue: Queue,
        private readonly redisService: RedisService, // ← RedisServiceを注入
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
            // DBチェック
            await this.checkDatabaseWithTimeout()
            // Redisチェック
            await this.checkRedisWithTimeout()
            // Bull Queueチェック
            const { bullStatus, jobCounts } = await this.checkBullQueueWithTimeout()
            // 全てOKならレスポンスを返す
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

    // タイムアウト付きでDB接続をチェック
    private async checkDatabaseWithTimeout(): Promise<void> {
        const supabase = this.supabaseRequestService.getClient()
        await this.withTimeout(
            (async () => {
                const { error } = await supabase.from('users').select('id').limit(1)
                if (error) {
                    throw new Error(`Database check failed: ${error.message}`)
                }
            })(),
            this.TIMEOUT_MS,
        ).catch((err) => {
            throw new Error(`Database check failed: ${err instanceof Error ? err.message : err}`)
        })
    }

    // タイムアウト付きでRedisにPINGを送信
    private async checkRedisWithTimeout(): Promise<void> {
        await this.withTimeout(
            (async () => {
                // RedisServiceからioredisインスタンスを取得
                const redisClient = this.redisService.createMainClient()
                const pingResult = await redisClient.ping()
                if (pingResult !== 'PONG') {
                    throw new Error(`Unexpected PING result: ${pingResult}`)
                }
            })(),
            this.TIMEOUT_MS,
        ).catch((err) => {
            throw new Error(`Redis check failed: ${err instanceof Error ? err.message : err}`)
        })
    }

    // タイムアウト付きでBull Queueをチェック
    private async checkBullQueueWithTimeout(): Promise<{
        bullStatus: string
        jobCounts: JobCounts
    }> {
        let jobCounts: JobCounts = {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
        }

        await this.withTimeout(
            (async () => {
                await this.feedQueue.isReady()
                jobCounts = await this.feedQueue.getJobCounts()
            })(),
            this.TIMEOUT_MS,
        ).catch((err) => {
            throw new Error(`Bull Queue check failed: ${err instanceof Error ? err.message : err}`)
        })

        return {
            bullStatus: 'OK',
            jobCounts,
        }
    }

    // 任意のPromiseに対して、指定msを超えた場合にタイムアウトErrorを投げるユーティリティ
    private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout after ${ms}ms`))
            }, ms)

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
