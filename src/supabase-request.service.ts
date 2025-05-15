// @file Supabaseクライアントのリクエストスコープサービス
import { Inject, Injectable, Scope } from '@nestjs/common'
// @see https://docs.nestjs.com/providers#injection-scopes
import { REQUEST } from '@nestjs/core'
// @see https://supabase.com/docs/reference/javascript/create-client
import { SupabaseClient, createClient } from '@supabase/supabase-js'
// @see https://expressjs.com/
import { Request } from 'express'
// @see ./types/schema
import { Database } from './types/schema'

@Injectable({ scope: Scope.REQUEST })
// @public
// @since 1.0.0
export class SupabaseRequestService {
    // @type {SupabaseClient<Database>}
    // @readonly
    // @private
    private readonly sbAnon: SupabaseClient<Database>
    // @type {SupabaseClient<Database>}
    // @readonly
    // @private
    private readonly sbAdmin: SupabaseClient<Database>

    // @param {Request} req - Expressリクエスト
    // @since 1.0.0
    // @public
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

    // @public
    // @since 1.0.0
    // @returns {SupabaseClient<Database>} - RLS適用クライアント
    // @example
    // const client = supabaseRequestService.getClient()
    getClient(): SupabaseClient<Database> {
        return this.sbAnon
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {string} userId - 削除対象ユーザーのID
    // @returns {Promise<any>} - 削除したユーザー情報
    // @throws {Error} - 削除に失敗した場合
    // @example
    // await supabaseRequestService.deleteUserAccount('user-id')
    // @see SupabaseClient.auth.admin.deleteUser
    async deleteUserAccount(userId: string) {
        const { error, data } = await this.sbAdmin.auth.admin.deleteUser(userId)
        if (error) throw error
        return data
    }

    // @async
    // @public
    // @since 1.0.0
    // @param {string} bucket - バケット名
    // @param {string} path - 保存先パス
    // @param {Buffer} fileBuffer - アップロードするファイルのBuffer
    // @param {string} contentType - Content-Type（デフォルト: 'application/octet-stream'）
    // @returns {Promise<{ publicUrl: string }>} - 公開URL
    // @throws {Error} - アップロードに失敗した場合
    // @example
    // await supabaseRequestService.uploadToStorage('bucket', 'path/file.txt', buffer, 'text/plain')
    // @see SupabaseClient.storage.from
    async uploadToStorage(
        bucket: string,
        path: string,
        fileBuffer: Buffer,
        contentType = 'application/octet-stream',
    ): Promise<{ publicUrl: string }> {
        const { error } = await this.sbAdmin.storage.from(bucket).upload(path, fileBuffer, {
            contentType,
            upsert: true,
        })
        if (error) throw error

        // 公開URLを取得
        const { data: urlData } = this.sbAdmin.storage.from(bucket).getPublicUrl(path)
        return { publicUrl: urlData.publicUrl }
    }
}
