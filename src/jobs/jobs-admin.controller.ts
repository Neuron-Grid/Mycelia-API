import { TypedBody, TypedParam, TypedQuery, TypedRoute } from "@nestia/core";
import { InjectQueue } from "@nestjs/bullmq";
import {
    Controller,
    HttpException,
    HttpStatus,
    UseGuards,
} from "@nestjs/common";
import { User as SupabaseUserType } from "@supabase/supabase-js";
import { Job, Queue } from "bullmq";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { SupabaseUser } from "@/auth/supabase-user.decorator";
import {
    buildResponse,
    type SuccessResponse,
} from "@/common/utils/response.util";
import { FailedJobsResponseDto } from "@/jobs/dto/failed-jobs.response.dto";
import { RetryAllDto } from "@/jobs/dto/retry-all.dto";
import { RetryAllResponseDto } from "@/jobs/dto/retry-all.response.dto";
import { RetryJobResponseDto } from "@/jobs/dto/retry-job.response.dto";

type DataWithOwner = { userId?: string; user_id?: string } & Record<
    string,
    unknown
>;

type QueueName =
    | "embeddingQueue"
    | "summary-generate"
    | "script-generate"
    | "podcastQueue";

@UseGuards(SupabaseAuthGuard)
@Controller("jobs")
export class JobsAdminController {
    constructor(
        @InjectQueue("embeddingQueue")
        private readonly embeddingQueue: Queue<DataWithOwner>,
        @InjectQueue("summary-generate")
        private readonly summaryQueue: Queue<DataWithOwner>,
        @InjectQueue("script-generate")
        private readonly scriptQueue: Queue<DataWithOwner>,
        @InjectQueue("podcastQueue")
        private readonly podcastQueue: Queue<DataWithOwner>,
    ) {}

    private getQueue(name: QueueName): Queue<DataWithOwner> {
        switch (name) {
            case "embeddingQueue":
                return this.embeddingQueue;
            case "summary-generate":
                return this.summaryQueue;
            case "script-generate":
                return this.scriptQueue;
            case "podcastQueue":
                return this.podcastQueue;
        }
    }

    /** List failed jobs for current user in a queue */
    @TypedRoute.Get("failed")
    async listFailed(
        @SupabaseUser() user: SupabaseUserType,
        @TypedQuery<{ queue: QueueName }>() q: { queue: QueueName },
    ): Promise<SuccessResponse<FailedJobsResponseDto>> {
        const queueName = q?.queue;
        const queue = this.getQueue(queueName);
        const jobs = await queue.getFailed(0, 100);
        const mine = jobs.filter(
            (j) => (j.data?.userId ?? j.data?.user_id) === user.id,
        );
        return buildResponse("Failed jobs fetched", {
            queue: queueName,
            count: mine.length,
            jobs: mine.map((j) => ({
                id: (j.id ?? "") as string,
                failedReason: (j.failedReason ?? "") as string,
                timestamp: (j.timestamp ?? 0) as number,
            })),
        });
    }

    /** Retry a specific failed job if it belongs to the user */
    @TypedRoute.Post(":jobId/retry")
    async retryJob(
        @SupabaseUser() user: SupabaseUserType,
        @TypedParam("jobId", (v) => v) jobId: string,
        @TypedQuery<{ queue: QueueName }>() q: { queue: QueueName },
    ): Promise<SuccessResponse<RetryJobResponseDto>> {
        const queueName = q?.queue;
        const queue = this.getQueue(queueName);
        const job = await queue.getJob(jobId);
        if (!job)
            throw new HttpException("Job not found", HttpStatus.NOT_FOUND);
        const owner = job.data?.userId ?? job.data?.user_id;
        if (owner !== user.id) {
            throw new HttpException("Forbidden", HttpStatus.FORBIDDEN);
        }
        await job.retry();
        return buildResponse("Job retried", { retried: true, jobId });
    }

    /** Retry all failed jobs for current user in the queue */
    @TypedRoute.Post("failed/retry")
    async retryAll(
        @SupabaseUser() user: SupabaseUserType,
        @TypedQuery<{ queue: QueueName }>() q: { queue: QueueName },
        @TypedBody() body?: RetryAllDto,
    ): Promise<SuccessResponse<RetryAllResponseDto>> {
        const queueName = q?.queue;
        const queue = this.getQueue(queueName);
        const limit = body?.max ?? 100;
        const jobs: Job<DataWithOwner>[] = await queue.getFailed(0, limit);
        let retried = 0;
        for (const job of jobs) {
            const owner = job.data?.userId ?? job.data?.user_id;
            if (owner === user.id) {
                try {
                    await job.retry();
                    retried++;
                } catch {
                    // noop: retry best-effort
                }
            }
        }
        return buildResponse("Jobs retried", { queue: queueName, retried });
    }
}
