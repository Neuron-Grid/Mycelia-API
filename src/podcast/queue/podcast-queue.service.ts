import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class PodcastQueueService {
    private readonly logger = new Logger(PodcastQueueService.name);

    constructor(@InjectQueue('podcastQueue') private readonly podcastQueue: Queue) {}

    //  ポッドキャスト生成ジョブをキューに追加
    //  @param text 音声合成するテキスト
    //  @param userId ユーザーID
    //  @param language 言語コード（デフォルト: ja-JP）
    //  @param filename 保存ファイル名（指定なしの場合は自動生成）
    //  @param title 書名（メタデータとして保存）
    async addPodcastJob(
        text: string,
        userId: string,
        language: 'ja-JP' | 'en-US' = 'ja-JP',
        filename?: string,
        title?: string,
    ) {
        // ファイル名が指定されていない場合は日付ベースで自動生成
        const actualFilename =
            filename || `podcast-${new Date().toISOString().slice(0, 10)}-${Date.now()}.opus`;

        this.logger.log(
            `ポッドキャスト生成ジョブをキューに追加: userId=${userId}, filename=${actualFilename}`,
        );

        await this.podcastQueue.add(
            // job name
            'default',
            // job data
            {
                text,
                userId,
                language,
                filename: actualFilename,
                title, // 書名を追加
            },
            {
                removeOnComplete: true,
                removeOnFail: false,
                // 最大3回リトライ
                attempts: 3,
                // 30秒後にリトライ
                backoff: { type: 'fixed', delay: 30_000 },
            },
        );

        return { filename: actualFilename };
    }
}
