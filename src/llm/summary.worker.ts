import { Processor } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'

@Processor('summary-generate')
@Injectable()
export class SummaryWorker {
    private readonly logger = new Logger(SummaryWorker.name)

    async process(job: Job) {
        this.logger.log(`Processing summary generation job: ${job.id} for user: ${job.data.userId}`)
        // TODO: 要約生成ロジックをここに実装
        await Promise.resolve()
        this.logger.log(`Summary generation job ${job.id} completed`)
        return {}
    }
}
