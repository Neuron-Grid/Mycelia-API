export interface EmbeddingBatchConfig {
    defaultBatchSize: number;
    maxBatchSize: number;
    openaiRateLimit: {
        batchSize: number;
        delayMs: number;
        maxRetries: number;
    };
    queue: {
        removeOnComplete: number;
        removeOnFail: number;
        attempts: number;
        backoffDelay: number;
    };
}

export const EMBEDDING_BATCH_CONFIG: EmbeddingBatchConfig = {
    defaultBatchSize: 50,
    maxBatchSize: 100,
    openaiRateLimit: {
        batchSize: 20, // OpenAI embedding API limit
        delayMs: 1000, // 1 second delay between batches
        maxRetries: 3,
    },
    queue: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 3,
        backoffDelay: 30000, // 30 seconds
    },
} as const;
