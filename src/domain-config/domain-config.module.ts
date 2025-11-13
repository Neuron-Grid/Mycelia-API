import { Module } from "@nestjs/common";
import { SupabaseRequestModule } from "@/supabase-request.module";
import { DomainConfigService } from "./domain-config.service";

@Module({
    imports: [SupabaseRequestModule],
    providers: [DomainConfigService],
    // 外部に公開したいサービスをexports
    exports: [DomainConfigService],
})
export class DomainConfigModule {}
