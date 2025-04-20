import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import { SupabaseClient, createClient } from '@supabase/supabase-js'
import { Request } from 'express'
import { Database } from './types/schema'

@Injectable({ scope: Scope.REQUEST })
export class SupabaseRequestService {
    private readonly sbAnon: SupabaseClient<Database>
    private readonly sbAdmin: SupabaseClient<Database>

    constructor(@Inject(REQUEST) private readonly req: Request) {
        const url = process.env.SUPABASE_URL
        const anonKey = process.env.SUPABASE_ANON_KEY
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!url || !anonKey) throw new Error('SUPABASE_URL / ANON_KEY missing')
        if (!serviceRole) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing')

        // 通常クライアント
        // RLS 適用
        const token = (this.req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
        this.sbAnon = createClient<Database>(url, anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
            global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        })

        // Service-Roleクライアント
        // RLSバイパス
        this.sbAdmin = createClient<Database>(url, serviceRole, {
            auth: { autoRefreshToken: false, persistSession: false },
        })
    }

    // RLS適用クライアントを返す
    getClient(): SupabaseClient<Database> {
        return this.sbAnon
    }

    // アカウント削除だけを実行するラッパー
    async deleteUserAccount(userId: string) {
        const { error, data } = await this.sbAdmin.auth.admin.deleteUser(userId)
        if (error) throw error
        return data
    }
}
