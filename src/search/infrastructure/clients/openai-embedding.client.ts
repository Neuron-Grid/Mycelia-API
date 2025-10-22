import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class OpenAIEmbeddingClient {
    private readonly logger = new Logger(OpenAIEmbeddingClient.name);
    private readonly apiKey: string;
    private readonly baseUrl = "https://api.openai.com/v1";
    private readonly requestTimeoutMs = 15_000;
    private readonly maxRetries = 3;
    private readonly initialRetryDelayMs = 1_000;

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>("OPENAI_API_KEY") || "";
        if (!this.apiKey) {
            this.logger.warn(
                "OPENAI_API_KEY not set, embedding service will not work",
            );
        }
    }

    // OpenAI Embeddings API response shapes
    private static readonly errorShape: {
        error?: { message?: string };
    } = {};

    private static readonly embeddingShape: {
        data: Array<{ embedding: number[] }>;
    } = { data: [] };

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
            const [embedding] = await this.requestEmbeddings([text.trim()]);

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
            const embeddings = await this.requestEmbeddings(
                validTexts.map((text) => text.trim()),
            );
            this.logger.debug(`Generated ${embeddings.length} embeddings`);

            return embeddings;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to generate embeddings: ${msg}`);
            throw error as Error;
        }
    }

    private async requestEmbeddings(inputs: string[]): Promise<number[][]> {
        if (inputs.length === 0) {
            throw new Error("Embeddings input cannot be empty");
        }

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            const controller = new AbortController();
            const timeout = setTimeout(
                () => controller.abort(),
                this.requestTimeoutMs,
            );

            let response: Response;
            try {
                response = await fetch(`${this.baseUrl}/embeddings`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: "text-embedding-3-small",
                        input: inputs,
                        encoding_format: "float",
                    }),
                    signal: controller.signal,
                });
            } catch (error) {
                clearTimeout(timeout);
                const wrappedError = this.toError(error);
                const shouldRetry = this.shouldRetryError(wrappedError);
                if (!shouldRetry || attempt === this.maxRetries) {
                    throw wrappedError;
                }

                lastError = wrappedError;
                this.logger.warn(
                    `OpenAI embeddings request failed (attempt ${attempt + 1}): ${wrappedError.message}. Retrying...`,
                );
                await this.delay(this.computeBackoff(attempt));
                continue;
            } finally {
                clearTimeout(timeout);
            }

            if (response.ok) {
                const parsed =
                    (await response.json()) as typeof OpenAIEmbeddingClient.embeddingShape;
                if (!parsed?.data || parsed.data.length === 0) {
                    throw new Error(
                        "No embedding data returned from OpenAI API",
                    );
                }
                return parsed.data.map((item) => item.embedding ?? []);
            }

            const detail = await this.extractErrorDetail(response);
            const apiError = this.httpError(
                response.status,
                `OpenAI API error: ${response.status} - ${detail || "Unknown error"}`,
            );

            if (
                !this.shouldRetryStatus(response.status) ||
                attempt === this.maxRetries
            ) {
                throw apiError;
            }

            lastError = apiError;
            this.logger.warn(
                `OpenAI embeddings request returned status ${response.status} (attempt ${attempt + 1}). Retrying...`,
            );
            await this.delay(this.computeBackoff(attempt));
        }

        throw lastError ?? new Error("Failed to call OpenAI embeddings API");
    }

    private shouldRetryStatus(status?: number): boolean {
        if (!status) {
            return false;
        }
        return status === 429 || status >= 500;
    }

    private shouldRetryError(error: Error & { status?: number }): boolean {
        if (error.name === "AbortError") {
            return true;
        }
        if (error.status) {
            return this.shouldRetryStatus(error.status);
        }
        return error instanceof TypeError;
    }

    private async extractErrorDetail(
        response: Response,
    ): Promise<string | undefined> {
        try {
            const errorData =
                (await response.json()) as typeof OpenAIEmbeddingClient.errorShape;
            return errorData?.error?.message;
        } catch {
            return undefined;
        }
    }

    private toError(reason: unknown): Error & { status?: number } {
        if (reason instanceof Error) {
            return reason as Error & { status?: number };
        }
        return new Error(String(reason)) as Error & { status?: number };
    }

    private computeBackoff(attempt: number): number {
        return this.initialRetryDelayMs * 2 ** attempt;
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
