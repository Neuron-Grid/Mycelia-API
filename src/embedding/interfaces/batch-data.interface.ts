import type { BatchItem, TableType } from "../types/embedding-batch.types";

export interface IBatchDataService {
    getMissingEmbeddingsCount(
        userId: string,
        tableType: TableType,
    ): Promise<number>;
    getBatchData(
        userId: string,
        tableType: TableType,
        batchSize: number,
        lastId?: number,
    ): Promise<BatchItem[]>;
}

export interface IBatchUpdateService {
    updateEmbeddings(
        userId: string,
        tableType: TableType,
        items: Array<{ id: number; embedding: number[] }>,
    ): Promise<void>;
}
