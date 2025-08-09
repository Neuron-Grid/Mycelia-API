import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { SupabaseRequestModule } from "src/supabase-request.module";
import { MaintenanceService } from "./maintenance.service";
import { MaintenanceQueueProcessor } from "./maintenance-queue.processor";

@Module({
    imports: [SupabaseRequestModule, BullModule.registerQueue({ name: "maintenanceQueue" })],
    providers: [MaintenanceService, MaintenanceQueueProcessor],
    exports: [BullModule],
})
export class MaintenanceQueueModule {}

