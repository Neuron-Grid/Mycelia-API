import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Request } from 'express'
import { SupabaseRequestService } from 'src/supabase-request.service'

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
    constructor(private readonly supabaseRequestService: SupabaseRequestService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>()
        const authHeader = request.headers.authorization

        // トークン未指定時の早期リターン
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('No valid Bearer token')
        }
        const token = authHeader.substring('Bearer '.length).trim()
        if (!token) {
            throw new UnauthorizedException('Empty token after Bearer prefix')
        }

        // Supabase Client でトークンを検証
        const supabase = this.supabaseRequestService.getClient()
        const { data, error } = await supabase.auth.getUser()

        // 返却メッセージの細分化
        // "expired" を含むかどうかで分岐し、
        // そのまま else を使わずに早期throw + 後続throwで実装
        if (error) {
            if (error.message?.toLowerCase().includes('expired')) {
                throw new UnauthorizedException('Token has expired')
            }
            throw new UnauthorizedException(`Invalid token: ${error.message}`)
        }

        if (!data.user) {
            throw new UnauthorizedException('No user found for this token')
        }

        // request.user にユーザー情報をセット
        request.user = data.user
        return true
    }
}
