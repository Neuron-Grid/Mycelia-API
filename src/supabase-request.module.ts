import { Module } from '@nestjs/common'
import { SupabaseRequestService } from './supabase-request.service'

@Module({
    providers: [SupabaseRequestService],
    exports: [SupabaseRequestService],
})
export class SupabaseRequestModule {}
