import type {
    BatchItem,
    EmbeddingUpdateItem,
    TableType,
} from "@/embedding/types/embedding-batch.types";

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
    getSingleItem(
        userId: string,
        tableType: TableType,
        recordId: number,
    ): Promise<BatchItem | null>;
}

export interface IBatchUpdateService {
    updateEmbeddings(
        userId: string,
        tableType: TableType,
        items: EmbeddingUpdateItem[],
    ): Promise<void>;
}
