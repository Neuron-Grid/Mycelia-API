import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DomainConfigService } from "./domain-config.service";

@Module({
    imports: [
        // ConfigModuleを読み込んでおく
        ConfigModule,
    ],
    providers: [DomainConfigService],
    // 外部に公開したいサービスをexports
    exports: [DomainConfigService],
})
export class DomainConfigModule {}
