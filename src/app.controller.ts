// @file アプリケーションのルートコントローラ
import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
// @see ./app.service
import { AppService } from "@/app.service";
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
    @Get()
    @ApiTags("Root")
    @ApiOkResponse({
        description: "Returns { message, data: string }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "string" },
            },
        },
    })
    getHello() {
        return buildResponse("OK", this.appService.getHello());
    }
}
