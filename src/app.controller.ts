// @file アプリケーションのルートコントローラ

import { TypedRoute } from "@nestia/core";
import { Controller } from "@nestjs/common";
// @see ./app.service
import { AppService } from "@/app.service";
import { GreetingResponseDto } from "@/common/dto/greeting-response.dto";
import { buildResponse } from "@/common/utils/response.util";

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
    @TypedRoute.Get("")
    /** Root endpoint returning greeting message */
    getHello(): GreetingResponseDto {
        return buildResponse("OK", this.appService.getHello());
    }
}
