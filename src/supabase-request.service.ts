import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { SupabaseClient, createClient } from '@supabase/supabase-js'
import { Request } from 'express'

@Injectable({ scope: Scope.REQUEST })
export class SupabaseRequestService {
    private supabase: SupabaseClient

    constructor(@Inject(REQUEST) private readonly req: Request) {
        // 必須の環境変数をチェック
        const url = process.env.SUPABASE_URL
        const anonKey = process.env.SUPABASE_ANON_KEY
        if (!url || !anonKey) {
            throw new Error(
                'Missing Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY).',
            )
        }

        // Authorization ヘッダから JWT (アクセストークン) を抜き出す
        const authHeader = this.req.headers.authorization ?? ''
        const token = authHeader.replace(/^Bearer\s+/, '')

        // Supabase SDK v2 の createClient: global.headers に Bearerトークンを付与
        // token が空の場合（未ログインユーザ等）はヘッダを付与しない
        this.supabase = createClient(url, anonKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
            global: {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            },
        })
    }

    //  このリクエストスコープに紐づく SupabaseClient を返す
    getClient() {
        return this.supabase
    }
}
