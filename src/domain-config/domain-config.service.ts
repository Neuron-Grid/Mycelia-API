import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class DomainConfigService {
    constructor(private readonly configService: ConfigService) {}

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
}
