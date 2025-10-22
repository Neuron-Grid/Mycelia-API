import { Global, Module } from "@nestjs/common";
import { JstDateService } from "./jst-date.service";

@Global()
@Module({
    providers: [JstDateService],
    exports: [JstDateService],
})
export class TimeModule {}
