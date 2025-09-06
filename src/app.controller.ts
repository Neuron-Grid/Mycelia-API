// @file アプリケーションのルートコントローラ

import { TypedRoute } from "@nestia/core";
import { Controller } from "@nestjs/common";
// @see ./app.service
import { AppService } from "@/app.service";
import { GreetingDto } from "@/common/dto/greeting.dto";
import {
    buildResponse,
    type SuccessResponse,
} from "@/common/utils/response.util";

@Controller()
// @public
// @since 1.0.0
export class AppController {
    // @param {AppService} appService - アプリケーションサービス
    // @since 1.0.0
    // @public
    constructor(private readonly appService: AppService) {}

    // @public
    // @since 1.0.0
    // @returns {string} - 挨拶メッセージ
    // @example
    // const msg = appController.getHello()
    // @see AppService.getHello
    @TypedRoute.Get<
        import("@/common/utils/response.util").ResponseEnvelope<
            import("@/common/dto/greeting.dto").GreetingDto
        >
    >("")
    /** Root endpoint returning greeting message */
    getHello(): SuccessResponse<GreetingDto> {
        return buildResponse("OK", { greeting: this.appService.getHello() });
    }
}
