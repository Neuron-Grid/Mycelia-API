// @file 認証・ユーザー管理のサービス層
import { Injectable } from "@nestjs/common";
// @see https://supabase.com/docs/reference/javascript/auth-api
import { User } from "@supabase/supabase-js";
import { DomainConfigService } from "@/domain-config/domain-config.service";
import { AuthRepositoryPort } from "./domain/auth.repository";

@Injectable()
// @public
// @since 1.0.0
export class AuthService {
    // @param {AuthRepositoryPort} authRepo - 認証リポジトリ
    // @param {DomainConfigService} domainCfg - ドメイン設定サービス
    // @since 1.0.0
    // @public
    constructor(
        private readonly authRepo: AuthRepositoryPort,
        private readonly domainCfg: DomainConfigService,
    ) {}

    // @async
    // @public
    // @since 1.0.0
    // @param {string} email - メールアドレス
    // @param {string} password - パスワード
    // @param {string} username - ユーザー名
    // @returns {Promise<unknown>} - 登録結果
    // @throws {Error} - 登録失敗時
    // @example
    // await authService.signUp('a@example.com', 'pw', 'user')
    // @see AuthRepositoryPort.signUp
    async signUp(email: string, password: string, username: string) {
        return await this.authRepo.signUp(email, password, username);
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {string} email - メールアドレス
    // @param {string} password - パスワード
    // @returns {Promise<unknown>} - ログイン結果
    // @throws {Error} - 認証失敗時
    // @example
    // await authService.signIn('a@example.com', 'pw')
    // @see AuthRepositoryPort.signIn
    async signIn(email: string, password: string) {
        return await this.authRepo.signIn(email, password);
    }

    // @async
    // @public
    // @since 1.0.0
    // @returns {Promise<unknown>} - ログアウト結果
    // @throws {Error} - ログアウト失敗時
    // @example
    // await authService.signOut()
    // @see AuthRepositoryPort.signOut
    async signOut() {
        return await this.authRepo.signOut();
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {string} userId - ユーザーID
    // @returns {Promise<unknown>} - アカウント削除結果
    // @throws {Error} - 削除失敗時
    // @example
    // await authService.deleteAccount('user-id')
    // @see AuthRepositoryPort.deleteAccount
    async deleteAccount(userId: string) {
        return await this.authRepo.deleteAccount(userId);
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - ユーザー
    // @param {string} newEmail - 新しいメールアドレス
    // @returns {Promise<unknown>} - メールアドレス更新結果
    // @throws {Error} - 更新失敗時
    // @example
    // await authService.updateEmail(user, 'new@example.com')
    // @see AuthRepositoryPort.updateEmail
    async updateEmail(user: User, newEmail: string) {
        return await this.authRepo.updateEmail(user.id, newEmail);
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - ユーザー
    // @param {string} newUsername - 新しいユーザー名
    // @returns {Promise<unknown>} - ユーザー名更新結果
    // @throws {Error} - 更新失敗時
    // @example
    // await authService.updateUsername(user, 'newname')
    // @see AuthRepositoryPort.updateUsername
    async updateUsername(user: User, newUsername: string) {
        return await this.authRepo.updateUsername(user.id, newUsername);
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {User} user - ユーザー
    // @param {string} oldPw - 現在のパスワード
    // @param {string} newPw - 新しいパスワード
    // @returns {Promise<unknown>} - パスワード更新結果
    // @throws {Error} - 更新失敗時
    // @example
    // await authService.updatePassword(user, 'old', 'new')
    // @see AuthRepositoryPort.updatePassword
    async updatePassword(user: User, oldPw: string, newPw: string) {
        return await this.authRepo.updatePassword(
            user.id,
            user.email ?? "",
            oldPw,
            newPw,
        );
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {string} email - メールアドレス
    // @returns {Promise<unknown>} - パスワードリセットメール送信結果
    // @throws {Error} - 送信失敗時
    // @example
    // await authService.forgotPassword('a@example.com')
    // @see AuthRepositoryPort.forgotPassword
    async forgotPassword(email: string) {
        return await this.authRepo.forgotPassword(
            email,
            this.domainCfg.getResetPasswordUrl(),
        );
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {string} accessToken - リセット用トークン
    // @param {string} newPw - 新しいパスワード
    // @returns {Promise<unknown>} - パスワードリセット結果
    // @throws {Error} - リセット失敗時
    // @example
    // await authService.resetPassword('token', 'newpw')
    // @see AuthRepositoryPort.resetPassword
    async resetPassword(accessToken: string, newPw: string) {
        return await this.authRepo.resetPassword(accessToken, newPw);
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {string} email - メールアドレス
    // @param {string} token - 認証トークン
    // @returns {Promise<unknown>} - メール認証結果
    // @throws {Error} - 認証失敗時
    // @example
    // await authService.verifyEmail('a@example.com', 'token')
    // @see AuthRepositoryPort.verifyEmail
    async verifyEmail(email: string, token: string) {
        return await this.authRepo.verifyEmail(email, token);
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {string} factorId - TOTPファクターID
    // @param {string} code - TOTPコード
    // @returns {Promise<unknown>} - TOTP認証結果
    // @throws {Error} - 認証失敗時
    // @example
    // await authService.verifyTotp('factorId', '123456')
    // @see AuthRepositoryPort.verifyTotp
    async verifyTotp(factorId: string, code: string) {
        return await this.authRepo.verifyTotp(factorId, code);
    }

    // リフレッシュトークンからアクセストークンを再発行
    async refreshAccessToken(refreshToken: string) {
        return await this.authRepo.refreshAccessToken(refreshToken);
    }
}
