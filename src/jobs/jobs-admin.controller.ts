import { InjectQueue } from "@nestjs/bullmq";
import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Param,
    Post,
    Query,
    UseGuards,
} from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiQuery,
    ApiTags,
} from "@nestjs/swagger";
import { User as SupabaseUserType } from "@supabase/supabase-js";
import { Job, Queue } from "bullmq";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { SupabaseUser } from "@/auth/supabase-user.decorator";
import { RetryAllDto } from "@/jobs/dto/retry-all.dto";

type DataWithOwner = { userId?: string; user_id?: string } & Record<
    string,
    unknown
>;

type QueueName =
    | "embeddingQueue"
    | "summary-generate"
    | "script-generate"
    | "podcastQueue";

@ApiTags("Jobs Admin")
@ApiBearerAuth()
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

    @Get("failed")
    @ApiOperation({ summary: "List failed jobs for current user in a queue" })
    @ApiQuery({ name: "queue", required: true })
    async listFailed(
        @SupabaseUser() user: SupabaseUserType,
        @Query("queue") queueName: QueueName,
    ) {
        const queue = this.getQueue(queueName);
        const jobs = await queue.getFailed(0, 100);
        const mine = jobs.filter(
            (j) => (j.data?.userId ?? j.data?.user_id) === user.id,
        );
        return {
            queue: queueName,
            count: mine.length,
            jobs: mine.map((j) => ({
                id: j.id,
                failedReason: j.failedReason,
                timestamp: j.timestamp,
            })),
        };
    }

    @Post(":jobId/retry")
    @ApiOperation({
        summary: "Retry a specific failed job if it belongs to the user",
    })
    @ApiQuery({ name: "queue", required: true })
    async retryJob(
        @SupabaseUser() user: SupabaseUserType,
        @Param("jobId") jobId: string,
        @Query("queue") queueName: QueueName,
    ) {
        const queue = this.getQueue(queueName);
        const job = await queue.getJob(jobId);
        if (!job)
            throw new HttpException("Job not found", HttpStatus.NOT_FOUND);
        const owner = job.data?.userId ?? job.data?.user_id;
        if (owner !== user.id) {
            throw new HttpException("Forbidden", HttpStatus.FORBIDDEN);
        }
        await job.retry();
        return { retried: true, jobId };
    }

    @Post("failed/retry")
    @ApiOperation({
        summary: "Retry all failed jobs for current user in the queue",
    })
    @ApiQuery({ name: "queue", required: true })
    @ApiBody({ type: RetryAllDto })
    async retryAll(
        @SupabaseUser() user: SupabaseUserType,
        @Query("queue") queueName: QueueName,
        @Body() body?: RetryAllDto,
    ) {
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
        return { queue: queueName, retried };
    }
}
