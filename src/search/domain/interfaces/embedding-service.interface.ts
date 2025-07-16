export interface EmbeddingService {
    generateEmbedding(text: string): Promise<number[]>;
    generateEmbeddings(texts: string[]): Promise<number[][]>;
    calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number;
    preprocessText(text: string): string;
}

export const EMBEDDING_SERVICE = Symbol('EmbeddingService');
