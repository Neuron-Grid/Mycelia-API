import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class DomainConfigService {
    constructor(private readonly configService: ConfigService) {}

    // ドメインを環境変数から取得。
    // なければデフォルト値を返す。
    getDomain(): string {
        return this.configService.get<string>('PRODUCTION_DOMAIN') ?? 'example.com'
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
