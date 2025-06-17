import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class EmbeddingService {
    private readonly logger = new Logger(EmbeddingService.name)
    private readonly apiKey: string
    private readonly baseUrl = 'https://api.openai.com/v1'

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('OPENAI_API_KEY') || ''
        if (!this.apiKey) {
            this.logger.warn('OPENAI_API_KEY not set, embedding service will not work')
        }
    }

    // text-embedding-3-smallを使用してテキストをベクトル化
    async generateEmbedding(text: string): Promise<number[]> {
        if (!this.apiKey) {
            throw new Error('OpenAI API key is not configured')
        }

        if (!text || text.trim().length === 0) {
            throw new Error('Text cannot be empty')
        }

        try {
            const response = await fetch(`${this.baseUrl}/embeddings`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: text.trim(),
                    encoding_format: 'float',
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(
                    `OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`,
                )
            }

            const result = await response.json()

            if (!result.data || result.data.length === 0) {
                throw new Error('No embedding data returned from OpenAI API')
            }

            const embedding = result.data[0].embedding
            this.logger.debug(
                `Generated embedding for text (${text.length} chars): ${embedding.length} dimensions`,
            )

            return embedding
        } catch (error) {
            this.logger.error(`Failed to generate embedding: ${error.message}`)
            throw error
        }
    }

    // バッチでのベクトル化（複数テキストを一度に処理）
    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        if (!this.apiKey) {
            throw new Error('OpenAI API key is not configured')
        }

        if (!texts || texts.length === 0) {
            throw new Error('Texts array cannot be empty')
        }

        // 空のテキストを除外
        const validTexts = texts.filter((text) => text && text.trim().length > 0)
        if (validTexts.length === 0) {
            throw new Error('No valid texts provided')
        }

        try {
            const response = await fetch(`${this.baseUrl}/embeddings`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: validTexts.map((text) => text.trim()),
                    encoding_format: 'float',
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(
                    `OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`,
                )
            }

            const result = await response.json()

            if (!result.data || result.data.length === 0) {
                throw new Error('No embedding data returned from OpenAI API')
            }

            const embeddings = result.data.map((item: any) => item.embedding)
            this.logger.debug(`Generated ${embeddings.length} embeddings`)

            return embeddings
        } catch (error) {
            this.logger.error(`Failed to generate embeddings: ${error.message}`)
            throw error
        }
    }

    // コサイン類似度を計算
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

    // テキストの前処理（埋め込み生成前のクリーニング）
    preprocessText(text: string): string {
        return text
            .replace(/\s+/g, ' ') // 複数の空白を単一スペースに
            .replace(/[^\w\s\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, ' ') // 英数字、ひらがな、カタカナ、漢字以外を空白に
            .trim()
            .substring(0, 8000) // OpenAI APIの制限を考慮して8000文字に制限
    }
}
