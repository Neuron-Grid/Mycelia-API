import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config' // ConfigService をインポート
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from './types/schema'

export const SUPABASE_CLIENT = 'SUPABASE_CLIENT'

@Module({
    providers: [
        {
            provide: SUPABASE_CLIENT,
            useFactory: (configService: ConfigService): SupabaseClient<Database> => {
                // ConfigService を注入
                const supabaseUrl = configService.get<string>('SUPABASE_URL') || ''
                const supabaseKey = configService.get<string>('SUPABASE_ANON_KEY') || ''
                return createClient(supabaseUrl, supabaseKey)
            },
            inject: [ConfigService], // ConfigService を注入する
        },
    ],
    exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
