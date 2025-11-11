import { Controller, Get, Header } from "@nestjs/common";
import { BullmqSupervisorService } from "@/jobs/bullmq-supervisor.service";

@Controller("metrics")
export class BullmqMetricsController {
    constructor(
        private readonly bullmqSupervisorService: BullmqSupervisorService,
    ) {}

    @Get("bullmq")
    @Header("Content-Type", "text/plain; version=0.0.4")
    @Header("Cache-Control", "no-store")
    async getBullmqMetrics(): Promise<string> {
        return await this.bullmqSupervisorService.getPrometheusSnapshot();
    }
}
