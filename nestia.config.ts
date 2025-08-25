import "reflect-metadata";
import type { INestiaConfig } from "@nestia/sdk";

const config: INestiaConfig = {
    input: "src/**/*.controller.ts",
    swagger: {
        output: "swagger.yaml",
        openapi: "3.1",
        servers: [{ url: "http://localhost:3000/api/v1" }],
    },
};

export default config;
