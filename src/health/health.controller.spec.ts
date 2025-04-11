import { getQueueToken } from '@nestjs/bull'
import { HttpException, HttpStatus } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { Queue } from 'bull'
import { SupabaseRequestService } from 'src/supabase-request.service'
import { HealthController } from './health.controller'

describe('HealthController', () => {
    let controller: HealthController
    let supabaseMock: Partial<SupabaseRequestService>
    let feedQueueMock: Partial<Queue>

    beforeEach(async () => {
        // SupabaseRequestService のモック
        supabaseMock = {
            getClient: jest.fn().mockReturnValue({
                from: () => ({
                    select: () => ({
                        limit: () => ({
                            single: async () => ({
                                // DBエラーなしを想定
                                error: null,
                            }),
                        }),
                    }),
                }),
            }),
        }

        // Bull Queue のモック
        feedQueueMock = {
            // isReady() 成功 → Promise.resolve()
            isReady: jest.fn().mockResolvedValue(undefined),
            // getJobCounts() でデフォルト値を返す
            getJobCounts: jest.fn().mockResolvedValue({
                waiting: 0,
                active: 0,
                completed: 0,
                failed: 0,
                delayed: 0,
            }),
        }

        const module: TestingModule = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [
                {
                    provide: SupabaseRequestService,
                    useValue: supabaseMock,
                },
                {
                    // ここが重要: @InjectQueue('feedQueue') は実際には
                    // getQueueToken('feedQueue') と同じトークン名を使う
                    provide: getQueueToken('feedQueue'),
                    useValue: feedQueueMock,
                },
            ],
        }).compile()

        controller = module.get<HealthController>(HealthController)
    })

    it('should return health check status OK', async () => {
        const result = await controller.checkHealth()
        expect(result.status).toBe('OK')
        expect(result.db).toBe('OK')
        expect(result.bullQueue.status).toBe('OK')
        expect(result.bullQueue.jobCounts).toBeDefined()
    })

    it('should throw HttpException if DB check fails', async () => {
        // DBエラーを強制発生
        ;(supabaseMock.getClient as jest.Mock).mockReturnValueOnce({
            from: () => ({
                select: () => ({
                    limit: () => ({
                        single: async () => ({
                            error: { message: 'DB error' },
                        }),
                    }),
                }),
            }),
        })

        await expect(controller.checkHealth()).rejects.toThrow(HttpException)
        try {
            await controller.checkHealth()
        } catch (e) {
            const httpError = e as HttpException
            expect(httpError.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
            expect(httpError.message).toContain('Health check failed')
            expect(httpError.message).toContain('DB error')
        }
    })

    it('should throw HttpException if Bull queue is not ready', async () => {
        // Redis がダウンしている想定
        ;(feedQueueMock.isReady as jest.Mock).mockRejectedValueOnce(new Error('Redis is down'))

        await expect(controller.checkHealth()).rejects.toThrow(HttpException)
        try {
            await controller.checkHealth()
        } catch (e) {
            const httpError = e as HttpException
            expect(httpError.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
            expect(httpError.message).toContain('Health check failed')
            expect(httpError.message).toContain('Redis is down')
        }
    })
})
