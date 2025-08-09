import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { MaintenanceService } from "./maintenance.service";

@Processor("maintenanceQueue")
@Injectable()
export class MaintenanceQueueProcessor extends WorkerHost {
    private readonly logger = new Logger(MaintenanceQueueProcessor.name);

    constructor(private readonly maintenance: MaintenanceService) {
        super();
    }

    async process(job: Job) {
        switch (job.name) {
            case "weeklyReindex":
                await this.maintenance.rebuildVectorIndexes();
                this.logger.log("Weekly vector reindex completed");
                return { success: true };
            default:
                this.logger.warn(`Unknown maintenance job: ${job.name}`);
        }
    }
}

