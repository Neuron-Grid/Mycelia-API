import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class OpenAIEmbeddingClient {
    private readonly logger = new Logger(OpenAIEmbeddingClient.name);
    private readonly apiKey: string;
    private readonly baseUrl = "https://api.openai.com/v1";

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>("OPENAI_API_KEY") || "";
        if (!this.apiKey) {
            this.logger.warn(
                "OPENAI_API_KEY not set, embedding service will not work",
            );
        }
    }

    // エラー種別を明確化するための簡易HTTPエラー
    private httpError(status: number, message: string): Error {
        const err = new Error(message) as Error & { status?: number };
        err.status = status;
        return err;
    }

    async generateEmbedding(text: string): Promise<number[]> {
        if (!this.apiKey) {
            throw new Error("OpenAI API key is not configured");
        }

        if (!text || text.trim().length === 0) {
            throw new Error("Text cannot be empty");
        }

        try {
            const response = await fetch(`${this.baseUrl}/embeddings`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "text-embedding-3-small",
                    input: text.trim(),
                    encoding_format: "float",
                }),
            });

            if (!response.ok) {
                let detail: string | undefined;
                try {
                    const errorData = await response.json();
                    detail = errorData.error?.message;
                } catch {
                    /* ignore parse error */
                }
                throw this.httpError(
                    response.status,
                    `OpenAI API error: ${response.status} - ${detail || "Unknown error"}`,
                );
            }

            const result = await response.json();

            if (!result.data || result.data.length === 0) {
                throw new Error("No embedding data returned from OpenAI API");
            }

            const embedding = result.data[0].embedding;
            this.logger.debug(
                `Generated embedding for text (${text.length} chars): ${embedding.length} dimensions`,
            );

            return embedding;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to generate embedding: ${msg}`);
            throw error as Error;
        }
    }

    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        if (!this.apiKey) {
            throw new Error("OpenAI API key is not configured");
        }

        if (!texts || texts.length === 0) {
            throw new Error("Texts array cannot be empty");
        }

        const validTexts = texts.filter(
            (text) => text && text.trim().length > 0,
        );
        if (validTexts.length === 0) {
            throw new Error("No valid texts provided");
        }

        try {
            const response = await fetch(`${this.baseUrl}/embeddings`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "text-embedding-3-small",
                    input: validTexts.map((text) => text.trim()),
                    encoding_format: "float",
                }),
            });

            if (!response.ok) {
                let detail: string | undefined;
                try {
                    const errorData = await response.json();
                    detail = errorData.error?.message;
                } catch {
                    /* ignore parse error */
                }
                throw this.httpError(
                    response.status,
                    `OpenAI API error: ${response.status} - ${detail || "Unknown error"}`,
                );
            }

            const result = await response.json();

            if (!result.data || result.data.length === 0) {
                throw new Error("No embedding data returned from OpenAI API");
            }

            const embeddings = result.data.map(
                (item: { embedding: number[] }) => item.embedding,
            );
            this.logger.debug(`Generated ${embeddings.length} embeddings`);

            return embeddings;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to generate embeddings: ${msg}`);
            throw error as Error;
        }
    }
}
