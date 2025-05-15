import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { PodcastTtsService } from '../podcast-tts.service'
import { PodcastUploadService } from '../podcast-upload.service'

interface PodcastJobData {
    text: string
    userId: string
    language: 'ja-JP' | 'en-US'
    filename: string
    title?: string // 書名を追加
}

@Processor('podcastQueue')
export class PodcastQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(PodcastQueueProcessor.name)

    constructor(
        private readonly ttsService: PodcastTtsService,
        private readonly uploadService: PodcastUploadService,
    ) {
        super()
    }

    // "default"ジョブを処理する
    async process(job: Job<PodcastJobData>) {
        const { text, userId, language, filename, title } = job.data
        this.logger.log(
            `ポッドキャスト生成ジョブ開始: userId=${userId}, lang=${language}, filename=${filename}`,
        )

        // 1. 音声合成（Opus形式）
        const audioBuffer = await this.ttsService.synthesizeNewsVoice(text, language)

        // 2. Cloudflare R2へアップロード（書名付き）
        const { publicUrl } = await this.uploadService.uploadPodcastAudio(
            audioBuffer,
            filename.replace('.mp3', '.opus'), // ファイル拡張子をopusに変更
            userId,
            title, // 書名を渡す
        )

        this.logger.log(`ポッドキャスト生成・R2アップロード完了: ${publicUrl}`)

        // 必要に応じてDBへメタデータ保存など

        return { publicUrl }
    }
}
