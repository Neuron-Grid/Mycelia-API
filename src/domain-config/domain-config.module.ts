import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SupabaseRequestModule } from "src/supabase-request.module";
import { DomainConfigService } from "./domain-config.service";

@Module({
    imports: [
        // ConfigModuleを読み込んでおく
        ConfigModule,
        SupabaseRequestModule,
    ],
    providers: [DomainConfigService],
    // 外部に公開したいサービスをexports
    exports: [DomainConfigService],
})
export class DomainConfigModule {}
