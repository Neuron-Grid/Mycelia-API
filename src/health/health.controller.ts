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
            const supabase = this.supabaseRequestService.getClient()

            const { error: dbError } = await supabase.from('users').select('id').limit(1).single()

            if (dbError) {
                throw new Error(`Database check failed: ${dbError.message}`)
            }

            let bullStatus: string
            let jobCounts: JobCounts | null = null

            try {
                await this.feedQueue.isReady()
                bullStatus = 'OK'
                jobCounts = await this.feedQueue.getJobCounts()
            } catch (bullError) {
                bullStatus = `NG: ${bullError instanceof Error ? bullError.message : bullError}`
            }

            if (bullStatus !== 'OK') {
                throw new Error(`Bull Queue check failed: ${bullStatus}`)
            }

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
