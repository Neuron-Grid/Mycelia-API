#!/usr/bin/env node
const { buildCliAppEnv } = require("./lib/env-loader");

function main() {
    try {
        const appEnv = buildCliAppEnv(process.env);
        const summary = [
            `appRole=${appEnv.appRole}`,
            `nodeEnv=${appEnv.nodeEnv}`,
            `port=${appEnv.port}`,
            `isWorkerApp=${appEnv.isWorkerApp}`,
            `isApiApp=${appEnv.isApiApp}`,
        ];
        console.log(
            `[validate:env] Environment validation succeeded (${summary.join(
                ", ",
            )})`,
        );
        process.exit(0);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : JSON.stringify(error);
        console.error(
            `[validate:env] Environment validation failed: ${message}`,
        );
        process.exit(1);
    }
}

main();
