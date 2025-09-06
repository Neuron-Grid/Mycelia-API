import { JobInfoDto } from "@/jobs/dto/job-info.dto";

export type QueueName =
    | "embeddingQueue"
    | "summary-generate"
    | "script-generate"
    | "podcastQueue";

export class FailedJobsResponseDto {
    queue!: QueueName;
    count!: number;
    jobs!: JobInfoDto[];
}
