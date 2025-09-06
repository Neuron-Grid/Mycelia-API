import type { INestiaConfig } from "@nestia/sdk";
import "reflect-metadata";

const config: INestiaConfig = {
    // PoC段階ではHealth配下のみを対象にしてnestiaのルート検出/生成を確認
    // 段階移行の後に input を広げる
    input: "src/**/*.controller.ts",
    clone: true,
    swagger: {
        output: "swagger.json",
        openapi: "3.1",
        servers: [
            {
                url: "{scheme}://{host}/api/v1",
                variables: {
                    scheme: { enum: ["https", "http"], default: "https" },
                    host: { default: "localhost:3000" },
                },
            },
            { url: "/api/v1" },
        ],
        beautify: 2,
        decompose: true,
        security: {
            bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
    },
};

export default config;
