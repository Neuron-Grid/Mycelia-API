import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CloudflareR2Service } from "@/podcast/cloudflare-r2.service";
import { SupabaseRequestService } from "@/supabase-request.service";

@Injectable()
export class PodcastUploadService {
    private readonly logger = new Logger(PodcastUploadService.name);
    private readonly bucketName: string;
    private readonly allowedBuckets: string[];
    private readonly allowedPrefixTemplates: string[];

    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
        private readonly cloudflareR2Service: CloudflareR2Service,
        private readonly configService: ConfigService,
    ) {
        const configuredBucket =
            this.configService.get<string>("CLOUDFLARE_BUCKET_NAME") ?? "";
        if (!configuredBucket) {
            throw new Error("CLOUDFLARE_BUCKET_NAME is not configured");
        }
        this.bucketName = configuredBucket;

        const configuredBuckets = this.parseList(
            this.configService.get<string>("CLOUDFLARE_ALLOWED_BUCKETS"),
        );
        this.allowedBuckets =
            configuredBuckets.length > 0
                ? configuredBuckets
                : [this.bucketName];

        const configuredPrefixes = this.parseList(
            this.configService.get<string>("CLOUDFLARE_ALLOWED_PREFIXES"),
        );
        this.allowedPrefixTemplates =
            configuredPrefixes.length > 0
                ? configuredPrefixes
                : ["podcasts/{userId}/"];
    }

    private parseList(raw?: string | null): string[] {
        if (!raw) return [];
        return raw
            .split(/[\s,]+/)
            .map((value) => value.trim())
            .filter((value) => value.length > 0);
    }

    private isBucketAllowed(bucket: string): boolean {
        return this.allowedBuckets.includes(bucket);
    }

    private getUserPrefix(userId: string): string {
        const template =
            this.allowedPrefixTemplates.find((tpl) =>
                tpl.includes("{userId}"),
            ) ??
            this.allowedPrefixTemplates[0] ??
            "podcasts/{userId}/";
        const replaced = template.replaceAll("{userId}", userId);
        const normalized = replaced.replace(/^\/+/, "");
        return normalized.endsWith("/") ? normalized : `${normalized}/`;
    }

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
        if (!this.isBucketAllowed(bucket)) {
            throw new Error(
                `Bucket '${bucket}' is not listed in CLOUDFLARE_ALLOWED_BUCKETS`,
            );
        }
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
        if (!this.isBucketAllowed(bucket)) {
            throw new Error(
                `Bucket '${bucket}' is not listed in CLOUDFLARE_ALLOWED_BUCKETS`,
            );
        }
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
        return this.bucketName;
    }

    //  オブジェクトキー（パス）を生成
    //  @param userId ユーザーID
    //  @param filename ファイル名
    private buildPodcastObjectKey(userId: string, filename: string): string {
        return `${this.getUserPrefix(userId)}${filename}`;
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
