import {
    DeleteObjectCommand,
    DeleteObjectsCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface PodcastMetadata {
    userId: string;
    summaryId: number;
    episodeId?: number;
    title: string;
    duration?: number;
    language: string;
    generatedAt: string;
}

@Injectable()
export class CloudflareR2Service {
    private readonly logger = new Logger(CloudflareR2Service.name);
    private readonly s3Client: S3Client;
    private readonly bucketName: string;
    private readonly publicDomain: string;

    constructor(private readonly configService: ConfigService) {
        // Cloudflare R2の接続情報
        const accountId = this.configService.get<string>(
            "CLOUDFLARE_ACCOUNT_ID",
        );
        const accessKeyId = this.configService.get<string>(
            "CLOUDFLARE_ACCESS_KEY_ID",
        );
        const secretAccessKey = this.configService.get<string>(
            "CLOUDFLARE_SECRET_ACCESS_KEY",
        );
        this.bucketName =
            this.configService.get<string>("CLOUDFLARE_BUCKET_NAME") || "";
        this.publicDomain =
            this.configService.get<string>("CLOUDFLARE_PUBLIC_DOMAIN") || "";

        if (
            !accountId ||
            !accessKeyId ||
            !secretAccessKey ||
            !this.bucketName
        ) {
            throw new Error("Cloudflare R2の環境変数が設定されていません");
        }

        this.s3Client = new S3Client({
            region: "auto",
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
    }

    // ポッドキャスト音声ファイルをR2にアップロード（メタデータ付き）
    async uploadPodcastAudio(
        userId: string,
        buffer: Buffer,
        metadata: PodcastMetadata,
    ): Promise<string> {
        try {
            // ユーザー固有のフォルダ構造でキーを生成
            const key = this.generatePodcastKey(
                userId,
                metadata.summaryId,
                metadata.generatedAt,
            );

            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                // 仕様に合わせてOpus(OGG)で保存
                ContentType: "audio/ogg",
                Metadata: {
                    "user-id": userId,
                    "summary-id": metadata.summaryId.toString(),
                    "episode-id": metadata.episodeId?.toString() || "",
                    title: metadata.title,
                    duration: metadata.duration?.toString() || "",
                    language: metadata.language,
                    "generated-at": metadata.generatedAt,
                    "content-type": "podcast-audio",
                },
            });

            await this.s3Client.send(command);

            // 公開URLを生成
            const publicUrl = this.getPublicUrl(key);
            this.logger.log(
                `Podcast audio uploaded successfully: ${publicUrl}`,
            );
            return publicUrl;
        } catch (error) {
            this.logger.error(
                `Failed to upload podcast audio: ${error.message}`,
            );
            throw error;
        }
    }

    // Cloudflare R2にファイルをアップロード（一般用）
    async uploadFile(
        bucket: string,
        key: string,
        body: Buffer,
        contentType: string,
        metadata?: Record<string, string>,
    ): Promise<{ publicUrl: string }> {
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            Metadata: metadata,
        });

        try {
            await this.s3Client.send(command);

            // 署名付きURLを生成（有効期限24時間）
            const url = await this.getSignedUrl(bucket, key, 86400);

            this.logger.log(`ファイルをR2にアップロード: ${key}`);
            return { publicUrl: url };
        } catch (error) {
            this.logger.error(
                `R2アップロードエラー: ${error.message}`,
                error.stack,
            );
            throw new Error(`R2アップロードエラー: ${error.message}`);
        }
    }

    // 署名付きURLを生成
    // @param bucket バケット名
    // @param key オブジェクトキー
    // @param expiresIn 有効期限（秒）
    // @returns 署名付きURL
    async getSignedUrl(
        bucket: string,
        key: string,
        expiresIn = 3600,
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        return await getSignedUrl(this.s3Client, command, { expiresIn });
    }

    // ファイルを削除
    // @param bucket バケット名
    // @param key オブジェクトキー
    async deleteFile(bucket: string, key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        try {
            await this.s3Client.send(command);
            this.logger.log(`ファイルをR2から削除: ${key}`);
        } catch (error) {
            this.logger.error(`R2削除エラー: ${error.message}`, error.stack);
            throw new Error(`R2削除エラー: ${error.message}`);
        }
    }

    // 既定バケットからオブジェクトを削除（アプリ内部向け）
    async deleteObject(key: string): Promise<void> {
        await this.deleteFile(this.bucketName, key);
    }

    // ユーザーのポッドキャストファイルを一括削除
    async deleteUserPodcasts(userId: string): Promise<void> {
        try {
            const userPrefix = `podcasts/${userId}/`;
            this.logger.log(
                `Deleting all podcast files for user ${userId} with prefix: ${userPrefix}`,
            );

            let continuationToken: string | undefined;
            let totalDeleted = 0;

            do {
                // 1. ユーザーフォルダ内のオブジェクト一覧を取得（最大1000件）
                const listCommand = new ListObjectsV2Command({
                    Bucket: this.bucketName,
                    Prefix: userPrefix,
                    MaxKeys: 1000,
                    ContinuationToken: continuationToken,
                });

                const listResult = await this.s3Client.send(listCommand);

                // 2. 削除対象オブジェクトが存在する場合
                if (listResult.Contents && listResult.Contents.length > 0) {
                    const objectsToDelete = listResult.Contents.filter(
                        (obj) => obj.Key,
                    ).map((obj) => ({ Key: obj.Key as string }));

                    // 3. バッチ削除実行（最大1000件）
                    if (objectsToDelete.length > 0) {
                        const deleteCommand = new DeleteObjectsCommand({
                            Bucket: this.bucketName,
                            Delete: {
                                Objects: objectsToDelete,
                                Quiet: false, // 削除結果を詳細に取得
                            },
                        });

                        const deleteResult =
                            await this.s3Client.send(deleteCommand);

                        // 削除結果の確認
                        if (deleteResult.Deleted) {
                            totalDeleted += deleteResult.Deleted.length;
                            this.logger.log(
                                `Successfully deleted ${deleteResult.Deleted.length} files for user ${userId}`,
                            );
                        }

                        // エラーがあった場合はログ出力
                        if (
                            deleteResult.Errors &&
                            deleteResult.Errors.length > 0
                        ) {
                            this.logger.warn(
                                `Some files could not be deleted for user ${userId}:`,
                                deleteResult.Errors,
                            );
                        }
                    }
                }

                // 4. 次のページがあるかチェック
                continuationToken = listResult.NextContinuationToken;
            } while (continuationToken);

            this.logger.log(
                `Completed deletion of ${totalDeleted} podcast files for user ${userId}`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to delete user podcasts: ${error.message}`,
                error.stack,
            );
            throw new Error(`Failed to delete user podcasts: ${error.message}`);
        }
    }

    // ポッドキャスト用のキーを生成（ユーザー分離とファイル管理）
    private generatePodcastKey(
        userId: string,
        summaryId: number,
        generatedAt: string,
    ): string {
        const date = new Date(generatedAt).toISOString().split("T")[0]; // YYYY-MM-DD
        const timestamp = Date.now();
        // 仕様に合わせて .opus 拡張子に変更
        return `podcasts/${userId}/${date}/summary-${summaryId}-${timestamp}.opus`;
    }

    // 公開URLを生成
    private getPublicUrl(key: string): string {
        if (this.publicDomain) {
            return `https://${this.publicDomain}/${key}`;
        }

        // カスタムドメインが設定されていない場合はデフォルトを使用
        const accountId = this.configService.get<string>(
            "CLOUDFLARE_ACCOUNT_ID",
        );
        return `https://${this.bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;
    }

    // オブジェクトを取得
    async getObject(key: string): Promise<string> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            const response = await this.s3Client.send(command);

            if (!response.Body) {
                throw new Error(`Object not found: ${key}`);
            }

            // ストリームをテキストに変換
            const chunks: Uint8Array[] = [];
            const reader = response.Body.transformToWebStream().getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            // バイトを文字列に変換
            const totalLength = chunks.reduce(
                (sum, chunk) => sum + chunk.length,
                0,
            );
            const combined = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                combined.set(chunk, offset);
                offset += chunk.length;
            }

            const content = new TextDecoder("utf-8").decode(combined);
            this.logger.log(`Successfully retrieved object: ${key}`);
            return content;
        } catch (error) {
            this.logger.error(`Failed to get object: ${key}`, error.stack);
            throw new Error(`Failed to get object: ${error.message}`);
        }
    }

    // URLからキーを抽出
    extractKeyFromUrl(url: string): string | null {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname.substring(1); // 先頭の / を除去
        } catch {
            return null;
        }
    }

    // ユーザー分離の確認（指定したキーが指定ユーザーのものかチェック）
    isUserFile(key: string, userId: string): boolean {
        return key.startsWith(`podcasts/${userId}/`);
    }

    // URL指定でユーザー所有を検証して削除
    async deleteByUrl(url: string, userId: string): Promise<void> {
        const key = this.extractKeyFromUrl(url);
        if (!key) throw new Error("Invalid podcast object URL");
        if (!this.isUserFile(key, userId))
            throw new Error("Access denied to podcast object");
        await this.deleteObject(key);
    }

    // ユーザー配下（podcasts/{userId}/）にオブジェクトが残っていないか確認
    async isUserNamespaceEmpty(userId: string): Promise<boolean> {
        try {
            const prefix = `podcasts/${userId}/`;
            const res = await this.s3Client.send(
                new ListObjectsV2Command({
                    Bucket: this.bucketName,
                    Prefix: prefix,
                    MaxKeys: 1,
                }),
            );
            const count =
                (res as { KeyCount?: number }).KeyCount ??
                (Array.isArray(res.Contents) ? res.Contents.length : 0);
            return count === 0;
        } catch (e) {
            // バケット不存在などは空扱い（冪等運用）
            this.logger.warn(
                `isUserNamespaceEmpty failed: ${(e as Error).message}`,
            );
            return true;
        }
    }
}
