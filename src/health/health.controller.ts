import { InjectQueue } from '@nestjs/bull'
import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common'
import { JobCounts, Queue } from 'bull'
import { SupabaseRequestService } from 'src/supabase-request.service'

@Controller('health')
export class HealthController {
    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
        @InjectQueue('feedQueue') private readonly feedQueue: Queue,
    ) {}

    @Get()
    async checkHealth() {
        try {
            // DB接続をチェック
            const supabase = this.supabaseRequestService.getClient()
            const { error: dbError } = await supabase.from('users').select('id').limit(1).single()

            if (dbError) {
                throw new Error(`Database check failed: ${dbError.message}`)
            }

            // Bull Queue / Redis接続をチェック
            let bullStatus: string
            let jobCounts: JobCounts | null = null

            try {
                // Queueの初期化状況
                await this.feedQueue.isReady()
                bullStatus = 'OK'

                // getJobCounts() を引数なしで呼び出す
                jobCounts = await this.feedQueue.getJobCounts()
            } catch (bullError) {
                // Redis接続エラー等
                bullStatus = `NG: ${bullError instanceof Error ? bullError.message : bullError}`
            }

            if (bullStatus !== 'OK') {
                throw new Error(`Bull Queue check failed: ${bullStatus}`)
            }

            // 正常時のレスポンス
            return {
                status: 'OK',
                db: 'OK',
                bullQueue: {
                    status: bullStatus,
                    jobCounts,
                },
            }
        } catch (err) {
            throw new HttpException(
                `Health check failed: ${err instanceof Error ? err.message : err}`,
                HttpStatus.SERVICE_UNAVAILABLE,
            )
        }
    }
}
