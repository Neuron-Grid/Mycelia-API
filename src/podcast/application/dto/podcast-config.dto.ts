import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsEnum, IsOptional, IsString, Matches } from 'class-validator'

/**
 * ポッドキャスト設定更新DTO
 * @description クライアントからのポッドキャスト設定更新リクエスト用DTO
 */
export class UpdatePodcastConfigDto {
    /**
     * ポッドキャスト機能の有効/無効
     * @type {boolean}
     */
    @ApiProperty({
        description: 'ポッドキャスト機能の有効/無効',
        example: true,
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    podcast_enabled?: boolean

    /**
     * ポッドキャスト生成スケジュール時刻（HH:MM形式）
     * @type {string}
     */
    @ApiProperty({
        description: 'ポッドキャスト生成スケジュール時刻（HH:MM形式）',
        example: '07:30',
        required: false,
    })
    @IsString()
    @IsOptional()
    @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'スケジュール時刻はHH:MM形式で指定してください（例: 07:30）',
    })
    podcast_schedule_time?: string

    /**
     * ポッドキャスト言語
     * @type {'ja-JP' | 'en-US'}
     */
    @ApiProperty({
        description: 'ポッドキャスト言語',
        example: 'ja-JP',
        enum: ['ja-JP', 'en-US'],
        required: false,
    })
    @IsEnum(['ja-JP', 'en-US'], {
        message: '言語は ja-JP または en-US のいずれかを指定してください',
    })
    @IsOptional()
    podcast_language?: 'ja-JP' | 'en-US'
}

/**
 * ポッドキャスト設定レスポンスDTO
 * @description サーバーから返却されるポッドキャスト設定情報
 */
export class PodcastConfigResponseDto {
    /**
     * ポッドキャスト機能の有効/無効
     * @type {boolean}
     */
    @ApiProperty({
        description: 'ポッドキャスト機能の有効/無効',
        example: true,
    })
    podcast_enabled: boolean

    /**
     * ポッドキャスト生成スケジュール時刻（HH:MM形式）
     * @type {string | null}
     */
    @ApiProperty({
        description: 'ポッドキャスト生成スケジュール時刻（HH:MM形式）',
        example: '07:30',
        nullable: true,
    })
    podcast_schedule_time: string | null

    /**
     * ポッドキャスト言語
     * @type {'ja-JP' | 'en-US'}
     */
    @ApiProperty({
        description: 'ポッドキャスト言語',
        example: 'ja-JP',
        enum: ['ja-JP', 'en-US'],
    })
    podcast_language: 'ja-JP' | 'en-US'

    /**
     * 最終更新日時
     * @type {string}
     */
    @ApiProperty({
        description: '最終更新日時',
        example: '2025-05-13T07:30:00.000Z',
    })
    updated_at: string
}
