// NOTE: DTOクラスは ./embedding/queue/dto/vector-update-job.dto.ts で定義
// ここでは型互換性のためにinterface定義を残す
export interface VectorUpdateJobData {
    userId: string;
    tableType: TableType;
    batchSize?: number;
    lastProcessedId?: number;
    totalEstimate?: number;
    recordId?: number;
}

export type TableType =
    | "feed_items"
    | "daily_summaries"
    | "podcast_episodes"
    | "tags";

export interface BatchItem {
    id: number;
    contentText: string;
}

export interface FeedItemBatch extends BatchItem {
    title: string;
    description?: string | null;
}

export interface SummaryBatch extends BatchItem {
    summaryTitle: string;
    markdown: string;
}

export interface PodcastBatch extends BatchItem {
    title: string;
}

export interface TagBatch extends BatchItem {
    tagName: string;
    description?: string | null;
}

export interface BatchProcessResult {
    processedCount: number;
    hasMore: boolean;
    lastProcessedId?: number;
}

export interface BatchProgress {
    userId: string;
    tableType: TableType;
    status: "waiting" | "running" | "completed" | "failed";
    progress: number;
    totalRecords?: number;
    processedRecords?: number;
    estimatedCompletion?: Date;
}

export interface EmbeddingUpdateItem {
    id: number;
    embedding: number[];
}
