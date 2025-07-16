// @file アプリケーションのルートコントローラ
import { Controller, Get } from "@nestjs/common";
// @see ./app.service
import { AppService } from "./app.service";

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
    getHello(): string {
        return this.appService.getHello();
    }
}
