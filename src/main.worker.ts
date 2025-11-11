import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppWorkerModule } from "@/app.worker.module";

async function bootstrapWorker() {
    const appContext = await NestFactory.createApplicationContext(
        AppWorkerModule,
        {
            bufferLogs: true,
        },
    );

    const logger = new Logger("WorkerBootstrap");
    logger.log("Mycelia worker context started");

    const shutdown = async (signal: string) => {
        logger.log(`Shutting down worker context due to ${signal}`);
        await appContext.close();
        process.exit(0);
    };

    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrapWorker().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to bootstrap worker context", error);
    process.exit(1);
});
