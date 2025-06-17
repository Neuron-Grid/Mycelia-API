import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SupabaseRequestService } from '../supabase-request.service'
import { UpdateUserSettingsDto, UserSettingsResponseDto } from './dto/user-settings.dto'

@Injectable()
export class DomainConfigService {
    private readonly logger = new Logger(DomainConfigService.name)

    constructor(
        private readonly configService: ConfigService,
        private readonly supabaseRequestService: SupabaseRequestService,
    ) {}

    // ドメインを環境変数から取得。
    // なければデフォルト値を返す。
    getDomain(): string {
        // ① FRONT_ORIGIN を取得（無ければ従来の PRODUCTION_DOMAIN）
        const origin =
            this.configService.get<string>('FRONT_ORIGIN') ??
            this.configService.get<string>('PRODUCTION_DOMAIN') ??
            'example.com'

        // originがスキーム付きならホスト名に変換
        try {
            // 'https://app.example.net' → 'app.example.net'
            return new URL(origin).hostname
        } catch {
            // 保険：古い Node でも動く
            return origin.replace(/^https?:\/\//, '')
        }
    }

    // パスワードリセット用のURLなどを、ドメイン + パスを合成して返す
    getResetPasswordUrl(): string {
        const domain = this.getDomain()
        return `https://${domain}/reset-password`
    }

    // メール認証用URLを取得する場合
    getVerifyEmailUrl(): string {
        const domain = this.getDomain()
        return `https://${domain}/verify-email`
    }

    // ユーザー設定を取得
    async getUserSettings(userId: string): Promise<UserSettingsResponseDto> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from('user_settings')
                .select('*')
                .eq('user_id', userId)
                .single()

            if (error) {
                if (error.code === 'PGRST116') {
                    // レコードが存在しない場合はデフォルト設定を作成
                    return await this.createDefaultUserSettings(userId)
                }
                throw error
            }

            return UserSettingsResponseDto.fromDatabaseRecord(data)
        } catch (error) {
            this.logger.error(`Failed to get user settings: ${error.message}`)
            throw error
        }
    }

    // ユーザー設定を更新
    async updateUserSettings(
        userId: string,
        dto: UpdateUserSettingsDto,
    ): Promise<UserSettingsResponseDto> {
        // バリデーション
        if (!dto.isValid()) {
            const messages = dto.getValidationMessages()
            throw new BadRequestException(`Invalid settings: ${messages.join(', ')}`)
        }

        try {
            const updateData = {
                ...dto.toPostgresData(),
                updated_at: new Date().toISOString(),
            }

            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from('user_settings')
                .upsert(
                    {
                        user_id: userId,
                        ...updateData,
                    },
                    { onConflict: 'user_id' },
                )
                .select()
                .single()

            if (error) throw error

            this.logger.log(`Updated user settings for user ${userId}`)
            return UserSettingsResponseDto.fromDatabaseRecord(data)
        } catch (error) {
            this.logger.error(`Failed to update user settings: ${error.message}`)
            throw error
        }
    }

    // デフォルトユーザー設定を作成
    async createDefaultUserSettings(userId: string): Promise<UserSettingsResponseDto> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from('user_settings')
                .insert({
                    user_id: userId,
                    refresh_every: '30 minutes', // デフォルト30分
                    podcast_enabled: false,
                    podcast_schedule_time: '07:00',
                    podcast_language: 'ja-JP',
                })
                .select()
                .single()

            if (error) throw error

            this.logger.log(`Created default user settings for user ${userId}`)
            return UserSettingsResponseDto.fromDatabaseRecord(data)
        } catch (error) {
            this.logger.error(`Failed to create default user settings: ${error.message}`)
            throw error
        }
    }

    // ポッドキャスト設定のみを更新
    async updatePodcastSettings(
        userId: string,
        enabled: boolean,
        scheduleTime?: string,
        language?: 'ja-JP' | 'en-US',
    ): Promise<UserSettingsResponseDto> {
        if (enabled && (!scheduleTime || !language)) {
            throw new BadRequestException(
                'Schedule time and language are required when enabling podcast',
            )
        }

        const updateData: {
            podcast_enabled: boolean
            updated_at: string
            podcast_schedule_time?: string
            podcast_language?: 'ja-JP' | 'en-US'
        } = {
            podcast_enabled: enabled,
            updated_at: new Date().toISOString(),
        }

        if (enabled) {
            updateData.podcast_schedule_time = scheduleTime
            updateData.podcast_language = language
        }

        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from('user_settings')
                .update(updateData)
                .eq('user_id', userId)
                .select()
                .single()

            if (error) throw error
            if (!data) {
                throw new NotFoundException('User settings not found')
            }

            this.logger.log(`Updated podcast settings for user ${userId}: enabled=${enabled}`)
            return UserSettingsResponseDto.fromDatabaseRecord(data)
        } catch (error) {
            this.logger.error(`Failed to update podcast settings: ${error.message}`)
            throw error
        }
    }

    // 指定時刻にポッドキャスト生成が有効なユーザーを取得
    async getUsersForPodcastGeneration(scheduleTime: string): Promise<string[]> {
        try {
            const { data, error } = await this.supabaseRequestService
                .getClient()
                .from('user_settings')
                .select('user_id')
                .eq('podcast_enabled', true)
                .eq('podcast_schedule_time', scheduleTime)

            if (error) throw error

            return data.map((record) => record.user_id)
        } catch (error) {
            this.logger.error(`Failed to get users for podcast generation: ${error.message}`)
            return []
        }
    }

    // ユーザー設定の統計情報を取得
    async getUserSettingsStats(userId: string) {
        try {
            const settings = await this.getUserSettings(userId)

            return {
                hasCustomSettings: true,
                refreshInterval: settings.refresh_every.toHumanReadable(),
                podcastEnabled: settings.podcast_enabled,
                podcastSchedule: settings.podcast_schedule_time,
                podcastLanguage: settings.podcast_language,
                lastUpdated: settings.updated_at,
                summary: settings.getReadableSummary(),
            }
        } catch (error) {
            this.logger.error(`Failed to get user settings stats: ${error.message}`)
            return {
                hasCustomSettings: false,
                refreshInterval: '30分（デフォルト）',
                podcastEnabled: false,
                podcastSchedule: null,
                podcastLanguage: 'ja-JP',
                lastUpdated: null,
                summary: 'デフォルト設定',
            }
        }
    }
}
