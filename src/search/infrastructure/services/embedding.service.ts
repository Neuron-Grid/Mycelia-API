import { Injectable, Logger } from '@nestjs/common'
import type { EmbeddingService as IEmbeddingService } from '../../domain/interfaces/embedding-service.interface'
import { OpenAIEmbeddingClient } from '../clients/openai-embedding.client'

@Injectable()
export class EmbeddingService implements IEmbeddingService {
    private readonly logger = new Logger(EmbeddingService.name)

    constructor(private readonly openAIClient: OpenAIEmbeddingClient) {}

    generateEmbedding(text: string): Promise<number[]> {
        return this.openAIClient.generateEmbedding(text)
    }

    generateEmbeddings(texts: string[]): Promise<number[][]> {
        return this.openAIClient.generateEmbeddings(texts)
    }

    calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
        if (vectorA.length !== vectorB.length) {
            throw new Error('Vectors must have the same length')
        }

        let dotProduct = 0
        let magnitudeA = 0
        let magnitudeB = 0

        for (let i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i]
            magnitudeA += vectorA[i] * vectorA[i]
            magnitudeB += vectorB[i] * vectorB[i]
        }

        magnitudeA = Math.sqrt(magnitudeA)
        magnitudeB = Math.sqrt(magnitudeB)

        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0
        }

        return dotProduct / (magnitudeA * magnitudeB)
    }

    preprocessText(text: string): string {
        return text
            .replace(/\s+/g, ' ') // 複数の空白を単一スペースに
            .replace(/[^\w\s\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, ' ') // 英数字、ひらがな、カタカナ、漢字以外を空白に
            .trim()
            .substring(0, 8000) // OpenAI APIの制限を考慮して8000文字に制限
    }
}
