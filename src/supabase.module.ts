import { Module } from '@nestjs/common'
import { SupabaseClient, createClient } from '@supabase/supabase-js'

export const SUPABASE_CLIENT = 'SUPABASE_CLIENT'

@Module({
    providers: [
        {
            provide: SUPABASE_CLIENT,
            useFactory: (): SupabaseClient => {
                const supabaseUrl = process.env.SUPABASE_URL || ''
                const supabaseKey = process.env.SUPABASE_ANON_KEY || ''
                return createClient(supabaseUrl, supabaseKey)
            },
        },
    ],
    exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
