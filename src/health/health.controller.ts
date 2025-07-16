// @file システムヘルスチェックAPIのコントローラ
import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get } from '@nestjs/common';
// @see https://docs.nestjs.com/openapi/introduction
import { ApiTags } from '@nestjs/swagger';
// @see https://docs.bullmq.io/
import { Queue } from 'bullmq';
import { RedisService } from 'src/shared/redis/redis.service';
import { SupabaseRequestService } from 'src/supabase-request.service';
import { HealthCheckResponseDto, JobCountsDto } from './dto/health-check-response.dto';

// BullMQ の戻り値用
// Swagger DTOとは別物
// @typedef {Awaited<ReturnType<Queue['getJobCounts']>>} RawJobCounts - BullMQジョブカウント型
type RawJobCounts = Awaited<ReturnType<Queue['getJobCounts']>>;

@ApiTags('Health')
@Controller('health')
// @public
// @since 1.0.0
export class HealthController {
    // @type {number}
    // @readonly
    // @private
    // @default 5000
    private readonly TIMEOUT_MS = 5000;

    // @param {SupabaseRequestService} supabaseRequestService - Supabaseリクエストサービス
    // @param {Queue} feedQueue - BullMQキュー
    // @param {RedisService} redisService - Redisサービス
    // @since 1.0.0
    // @public
    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
        @InjectQueue('feedQueue') private readonly feedQueue: Queue,
        private readonly redisService: RedisService,
    ) {}

    // @async
    // @public
    // @since 1.0.0
    // @returns {Promise<HealthCheckResponseDto>} - ヘルスチェック結果
    // @throws {HttpException} - チェック失敗時
    // @example
    // await healthController.checkHealth()
    // @see HealthCheckResponseDto
    @Get()
    @Get()
    async checkHealth(): Promise<HealthCheckResponseDto> {
        await this.checkDatabaseWithTimeout();
        await this.checkRedisWithTimeout();
        const { bullStatus, jobCounts } = await this.checkBullQueueWithTimeout();

        return {
            status: 'OK',
            db: 'OK',
            bullQueue: {
                status: bullStatus,
                jobCounts,
            },
            redis: 'OK',
        };
    }
    // @async
    // @private
    // @since 1.0.0
    // @returns {Promise<void>} - DBチェック結果
    // @throws {Error} - DBチェック失敗時
    // @example
    // await healthController['checkDatabaseWithTimeout']()
    // @see SupabaseRequestService.getClient
    private async checkDatabaseWithTimeout(): Promise<void> {
        const supabase = this.supabaseRequestService.getClient();

        await this.withTimeout(
            (async () => {
                const { error } = await supabase.from('users').select('id').limit(1);
                if (error) {
                    throw new Error(`Database check failed: ${error.message}`);
                }
            })(),
            this.TIMEOUT_MS,
        );
    }

    // @async
    // @private
    // @since 1.0.0
    // @returns {Promise<void>} - Redisチェック結果
    // @throws {Error} - Redisチェック失敗時
    // @example
    // await healthController['checkRedisWithTimeout']()
    // @see RedisService.createMainClient
    private async checkRedisWithTimeout(): Promise<void> {
        await this.withTimeout(
            (async () => {
                const redisClient = this.redisService.createMainClient();
                const pingResult = await redisClient.ping();
                if (pingResult !== 'PONG') {
                    throw new Error(`Unexpected PING result: ${pingResult}`);
                }
            })(),
            this.TIMEOUT_MS,
        );
    }

    // @async
    // @private
    // @since 1.0.0
    // @returns {Promise<{ bullStatus: string, jobCounts: JobCountsDto }>} - BullMQチェック結果
    // @throws {Error} - BullMQチェック失敗時
    // @example
    // await healthController['checkBullQueueWithTimeout']()
    // @see Queue.getJobCounts
    private async checkBullQueueWithTimeout(): Promise<{
        bullStatus: string;
        jobCounts: JobCountsDto;
    }> {
        // DTOと同じキーを持つ初期値
        let jobCounts: JobCountsDto = {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
        };

        await this.withTimeout(
            (async () => {
                await this.feedQueue.waitUntilReady();
                const counts: RawJobCounts = await this.feedQueue.getJobCounts();

                jobCounts = {
                    waiting: counts.waiting ?? 0,
                    active: counts.active ?? 0,
                    completed: counts.completed ?? 0,
                    failed: counts.failed ?? 0,
                    delayed: counts.delayed ?? 0,
                };
            })(),
            this.TIMEOUT_MS,
        );

        return {
            bullStatus: 'OK',
            jobCounts,
        };
    }

    // @async
    // @private
    // @since 1.0.0
    // @template T
    // @param {Promise<T>} promise - タイムアウトをかけるPromise
    // @param {number} ms - タイムアウト時間（ミリ秒）
    // @returns {Promise<T>} - 結果
    // @throws {Error} - タイムアウト時
    // @example
    // await healthController['withTimeout'](Promise.resolve(1), 1000)
    private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);

            promise
                .then((res) => {
                    clearTimeout(timer);
                    resolve(res);
                })
                .catch((err) => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }
}
