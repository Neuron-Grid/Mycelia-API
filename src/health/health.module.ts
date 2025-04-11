import { Module } from '@nestjs/common'
import { SupabaseRequestModule } from 'src/supabase-request.module'
import { HealthController } from './health.controller'

@Module({
    imports: [SupabaseRequestModule],
    controllers: [HealthController],
})
export class HealthModule {}
