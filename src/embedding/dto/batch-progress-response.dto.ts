import type { BatchProgress, TableType } from "../types/embedding-batch.types";

export class BatchProgressItemDto implements BatchProgress {
    /** User ID (UUID) */
    userId: string;

    /** Target table type */
    tableType: TableType;

    /** Job status */
    status: "waiting" | "running" | "completed" | "failed";

    /** Progress percentage (0-100) */
    progress: number;

    /** Total records count */
    totalRecords?: number;

    /** Processed records count */
    processedRecords?: number;

    /** Estimated completion time */
    estimatedCompletion?: Date;
}

export class BatchProgressResponseDto {
    /** Response message */
    message: string;

    /** Array of batch progress information */
    data: BatchProgressItemDto[];
}
