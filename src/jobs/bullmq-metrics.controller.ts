import { Controller, Get, Header, Res } from "@nestjs/common";
import { Response } from "express";
import { BullmqSupervisorService } from "@/jobs/bullmq-supervisor.service";

@Controller("metrics")
export class BullmqMetricsController {
    constructor(
        private readonly bullmqSupervisorService: BullmqSupervisorService,
    ) {}

    @Get("bullmq")
    @Header("Content-Type", "text/plain")
    @Header("Cache-Control", "no-store")
    async getBullmqMetrics(
        @Res({ passthrough: true }) res: Response,
    ): Promise<string> {
        res.setHeader(
            "Content-Type",
            "text/plain; version=0.0.4; charset=utf-8",
        );
        return await this.bullmqSupervisorService.getPrometheusSnapshot();
    }
}
