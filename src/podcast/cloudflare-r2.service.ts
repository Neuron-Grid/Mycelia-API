import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface PodcastMetadata {
    userId: string
    summaryId: number
    episodeId?: number
    title: string
    duration?: number
    language: string
    generatedAt: string
}

@Injectable()
export class CloudflareR2Service {
    private readonly logger = new Logger(CloudflareR2Service.name)
    private readonly s3Client: S3Client
    private readonly bucketName: string
    private readonly publicDomain: string

    constructor(private readonly configService: ConfigService) {
        // Cloudflare R2の接続情報
        const accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID')
        const accessKeyId = this.configService.get<string>('CLOUDFLARE_ACCESS_KEY_ID')
        const secretAccessKey = this.configService.get<string>('CLOUDFLARE_SECRET_ACCESS_KEY')
        this.bucketName = this.configService.get<string>('CLOUDFLARE_BUCKET_NAME') || ''
        this.publicDomain = this.configService.get<string>('CLOUDFLARE_PUBLIC_DOMAIN') || ''

        if (!accountId || !accessKeyId || !secretAccessKey || !this.bucketName) {
            throw new Error('Cloudflare R2の環境変数が設定されていません')
        }

        this.s3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        })
    }

    // ポッドキャスト音声ファイルをR2にアップロード（メタデータ付き）
    async uploadPodcastAudio(
        userId: string, 
        buffer: Buffer, 
        metadata: PodcastMetadata
    ): Promise<string> {
        try {
            // ユーザー固有のフォルダ構造でキーを生成
            const key = this.generatePodcastKey(userId, metadata.summaryId, metadata.generatedAt)
            
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                ContentType: 'audio/mpeg',
                Metadata: {
                    'user-id': userId,
                    'summary-id': metadata.summaryId.toString(),
                    'episode-id': metadata.episodeId?.toString() || '',
                    'title': metadata.title,
                    'duration': metadata.duration?.toString() || '',
                    'language': metadata.language,
                    'generated-at': metadata.generatedAt,
                    'content-type': 'podcast-audio',
                },
            })

            await this.s3Client.send(command)

            // 公開URLを生成
            const publicUrl = this.getPublicUrl(key)
            this.logger.log(`Podcast audio uploaded successfully: ${publicUrl}`)
            return publicUrl
        } catch (error) {
            this.logger.error(`Failed to upload podcast audio: ${error.message}`)
            throw error
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
        })

        try {
            await this.s3Client.send(command)

            // 署名付きURLを生成（有効期限24時間）
            const url = await this.getSignedUrl(bucket, key, 86400)

            this.logger.log(`ファイルをR2にアップロード: ${key}`)
            return { publicUrl: url }
        } catch (error) {
            this.logger.error(`R2アップロードエラー: ${error.message}`, error.stack)
            throw new Error(`R2アップロードエラー: ${error.message}`)
        }
    }

    // 署名付きURLを生成
    // @param bucket バケット名
    // @param key オブジェクトキー
    // @param expiresIn 有効期限（秒）
    // @returns 署名付きURL
    async getSignedUrl(bucket: string, key: string, expiresIn = 3600): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        })

        return await getSignedUrl(this.s3Client, command, { expiresIn })
    }

    // ファイルを削除
    // @param bucket バケット名
    // @param key オブジェクトキー
    async deleteFile(bucket: string, key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
        })

        try {
            await this.s3Client.send(command)
            this.logger.log(`ファイルをR2から削除: ${key}`)
        } catch (error) {
            this.logger.error(`R2削除エラー: ${error.message}`, error.stack)
            throw new Error(`R2削除エラー: ${error.message}`)
        }
    }

    // ユーザーのポッドキャストファイルを一括削除
    async deleteUserPodcasts(userId: string): Promise<void> {
        try {
            // ユーザーフォルダ内のすべてのファイルを削除
            // 実際の実装では ListObjectsV2Command を使ってファイル一覧を取得してから削除
            const userPrefix = `podcasts/${userId}/`
            
            // 簡易実装: 単一ファイルのみ削除（本来はリスト取得後に一括削除）
            this.logger.log(`Deleting all podcast files for user ${userId} with prefix: ${userPrefix}`)
            
            // TODO: ListObjectsV2Command を使用して実際のファイル一覧を取得し、一括削除を実装
        } catch (error) {
            this.logger.error(`Failed to delete user podcasts: ${error.message}`)
            throw error
        }
    }

    // ポッドキャスト用のキーを生成（ユーザー分離とファイル管理）
    private generatePodcastKey(userId: string, summaryId: number, generatedAt: string): string {
        const date = new Date(generatedAt).toISOString().split('T')[0] // YYYY-MM-DD
        const timestamp = Date.now()
        return `podcasts/${userId}/${date}/summary-${summaryId}-${timestamp}.mp3`
    }

    // 公開URLを生成
    private getPublicUrl(key: string): string {
        if (this.publicDomain) {
            return `https://${this.publicDomain}/${key}`
        }
        
        // カスタムドメインが設定されていない場合はデフォルトを使用
        const accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID')
        return `https://${this.bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`
    }

    // URLからキーを抽出
    extractKeyFromUrl(url: string): string | null {
        try {
            const urlObj = new URL(url)
            return urlObj.pathname.substring(1) // 先頭の / を除去
        } catch {
            return null
        }
    }

    // ユーザー分離の確認（指定したキーが指定ユーザーのものかチェック）
    isUserFile(key: string, userId: string): boolean {
        return key.startsWith(`podcasts/${userId}/`)
    }
}
