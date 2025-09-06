export class JobStateDto {
    state!: "waiting" | "active" | "completed" | "failed" | "skipped" | "idle";
    jobId!: string | null;
}

export class JobsStatusResponseDto {
    date!: string;
    summary!: JobStateDto;
    script!: JobStateDto;
    podcast!: JobStateDto;
}
