import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class CloudflareR2Service {
    private readonly logger = new Logger(CloudflareR2Service.name)
    private readonly s3Client: S3Client

    constructor() {
        // Cloudflare R2の接続情報
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
        const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID
        const secretAccessKey = process.env.CLOUDFLARE_SECRET_ACCESS_KEY

        if (!accountId || !accessKeyId || !secretAccessKey) {
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

    // Cloudflare R2にファイルをアップロード
    // @param bucket バケット名
    // @param key 保存先キー（パス）
    // @param body ファイルのBuffer
    // @param contentType Content-Type
    // @param metadata メタデータ（書名など）
    // @returns publicUrl: string
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
}
