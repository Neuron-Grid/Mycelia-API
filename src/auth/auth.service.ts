import { Injectable } from '@nestjs/common'
import { User } from '@supabase/supabase-js'
import { DomainConfigService } from 'src/domain-config/domain-config.service'
import { AuthRepositoryPort } from './domain/auth.repository'

@Injectable()
export class AuthService {
    constructor(
        private readonly authRepo: AuthRepositoryPort,
        private readonly domainCfg: DomainConfigService,
    ) {}

    async signUp(email: string, password: string, username: string) {
        return await this.authRepo.signUp(email, password, username)
    }

    async signIn(email: string, password: string) {
        return await this.authRepo.signIn(email, password)
    }

    async signOut() {
        return await this.authRepo.signOut()
    }

    async deleteAccount(userId: string) {
        return await this.authRepo.deleteAccount(userId)
    }

    async updateEmail(user: User, newEmail: string) {
        return await this.authRepo.updateEmail(user.id, newEmail)
    }

    async updateUsername(user: User, newUsername: string) {
        return await this.authRepo.updateUsername(user.id, newUsername)
    }

    async updatePassword(user: User, oldPw: string, newPw: string) {
        return await this.authRepo.updatePassword(user.email ?? '', oldPw, newPw)
    }

    async forgotPassword(email: string) {
        return await this.authRepo.forgotPassword(email, this.domainCfg.getResetPasswordUrl())
    }

    async resetPassword(accessToken: string, newPw: string) {
        return await this.authRepo.resetPassword(accessToken, newPw)
    }

    async verifyEmail(email: string, token: string) {
        return await this.authRepo.verifyEmail(email, token)
    }

    async verifyTotp(factorId: string, code: string) {
        return await this.authRepo.verifyTotp(factorId, code)
    }
}
