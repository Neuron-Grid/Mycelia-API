import { Processor } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'

@Processor('script-generate')
@Injectable()
export class ScriptWorker {
    private readonly logger = new Logger(ScriptWorker.name)

    // BullMQでは@Processデコレータは不要。handleメソッド名で自動的に紐付く場合もあるが、明示的にjob nameで分岐するのが安全。
    async process(job: Job) {
        this.logger.log(
            `Processing script generation job: ${job.id} for summaryId: ${job.data.summaryId}`,
        )
        // TODO: 台本生成ロジックをここに実装
        await Promise.resolve()
        this.logger.log(`Script generation job ${job.id} completed`)
        return {}
    }
}
