// @file アプリケーションのサービス層
import { Injectable } from "@nestjs/common";

@Injectable()
// @public
// @since 1.0.0
export class AppService {
    // @public
    // @since 1.0.0
    // @returns {string} - 'Hello World!' というメッセージ
    // @example
    // const msg = appService.getHello()
    getHello(): string {
        return "Hello World!";
    }
}
