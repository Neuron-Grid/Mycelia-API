import { Injectable, Logger } from "@nestjs/common";
import { SupabaseRequestService } from "../supabase-request.service";
import { CloudflareR2Service } from "./cloudflare-r2.service";

@Injectable()
export class PodcastUploadService {
    private readonly logger = new Logger(PodcastUploadService.name);

    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
        private readonly cloudflareR2Service: CloudflareR2Service,
    ) {}

    // ポッドキャスト音声ファイルをCloudflare R2にアップロード
    // @param fileBuffer 音声ファイルのBuffer
    // @param filename 保存ファイル名（例: "20240513-xxxx.opus"）
    // @param userId ユーザーID（バケットやパスに利用）
    // @param title 書名（メタデータとして保存）
    // @returns publicUrl: string
    async uploadPodcastAudio(
        fileBuffer: Buffer,
        filename: string,
        userId: string,
        title?: string,
    ): Promise<{ publicUrl: string }> {
        const bucket = this.getPodcastBucketName();
        const key = this.buildPodcastObjectKey(userId, filename);
        const contentType = "audio/ogg"; // Opus形式のContent-Type

        const metadata = this.buildPodcastMetadata(userId, title);

        const { publicUrl } = await this.cloudflareR2Service.uploadFile(
            bucket,
            key,
            fileBuffer,
            contentType,
            metadata,
        );
        this.logger.log(`音声ファイルをR2にアップロード: ${publicUrl}`);
        return { publicUrl };
    }

    // レガシー: ポッドキャスト音声ファイルをSupabase Storageにアップロード
    // @deprecated Cloudflare R2に移行中
    async uploadPodcastAudioToSupabase(
        fileBuffer: Buffer,
        filename: string,
        userId: string,
    ): Promise<{ publicUrl: string }> {
        const bucket = this.getPodcastBucketName();
        const path = this.buildPodcastObjectKey(userId, filename);
        const contentType = "audio/mpeg";

        const { publicUrl } = await this.supabaseRequestService.uploadToStorage(
            bucket,
            path,
            fileBuffer,
            contentType,
        );
        this.logger.log(`音声ファイルをSupabaseにアップロード: ${publicUrl}`);
        return { publicUrl };
    }

    //  ポッドキャスト用バケット名を返す
    private getPodcastBucketName(): string {
        return "podcasts";
    }

    //  オブジェクトキー（パス）を生成
    //  @param userId ユーザーID
    //  @param filename ファイル名
    private buildPodcastObjectKey(userId: string, filename: string): string {
        return `${userId}/${filename}`;
    }

    //  メタデータを生成
    //  @param userId ユーザーID
    //  @param title 書名
    private buildPodcastMetadata(
        userId: string,
        title?: string,
    ): Record<string, string> {
        const metadata: Record<string, string> = {
            userId,
            createdAt: new Date().toISOString(),
        };
        if (title) {
            metadata.title = title;
        }
        return metadata;
    }
}
