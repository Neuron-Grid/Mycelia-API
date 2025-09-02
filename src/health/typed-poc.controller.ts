import { TypedRoute } from "@nestia/core";
import { Controller } from "@nestjs/common";

@Controller("typed-poc")
export class TypedPocController {
    @TypedRoute.Get("ping")
    ping(): { message: string } {
        return { message: "pong" };
    }
}
