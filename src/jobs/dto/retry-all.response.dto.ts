import type { QueueName } from "@/jobs/dto/failed-jobs.response.dto";

export class RetryAllResponseDto {
    queue!: QueueName;
    retried!: number;
}
