import { createHash } from "node:crypto";
import { HttpService } from "@nestjs/axios";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { AxiosError, AxiosResponse } from "axios";
import { backOff } from "exponential-backoff";
import { firstValueFrom } from "rxjs";
import sanitizeMarkdown from "sanitize-markdown";
import { APP_ENV_TOKEN, type AppEnv } from "@/config/app-env";
import {
    GeminiScriptRequest,
    GeminiScriptResponse,
    GeminiSummaryRequest,
    GeminiSummaryResponse,
    LlmService,
} from "../../application/services/llm.service";

interface GeminiApiResponseCandidate {
    content?: {
        parts?: Array<{ text?: string }>;
        role?: string;
    };
    finishReason?: string;
}
interface GeminiApiResponse {
    candidates?: Array<GeminiApiResponseCandidate>;
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
    };
}

interface GeminiErrorDetail {
    // Gemini APIが返す可能性のあるエラー詳細構造
    "@type"?: string;
    reason?: string; // 例: "API_KEY_INVALID"
    domain?: string;
    metadata?: Record<string, unknown>;
}

interface GeminiErrorPayload {
    // Gemini APIの実際のエラーレスポンスの'error'フィールド
    code?: number; // HTTPステータスとは別の内部エラーコード
    message?: string;
    status?: string; // 例: "INVALID_ARGUMENT", "RESOURCE_EXHAUSTED"
    details?: GeminiErrorDetail[];
}

@Injectable()
export class GeminiFlashClient implements LlmService {
    public logger = new Logger(GeminiFlashClient.name);
    public readonly apiUrl: string;
    public readonly apiKey: string;
    public readonly defaultTimeout = 30000;

    constructor(
        public readonly http: HttpService,
        @Inject(APP_ENV_TOKEN) private readonly appEnv: AppEnv,
    ) {
        const config = this.appEnv.getGeminiConfig();
        this.apiUrl = config.apiUrl;
        this.apiKey = config.apiKey;

        if (!this.apiKey) {
            this.logger.error("GEMINI_API_KEY is not set");
            throw new Error(
                "GEMINI_API_KEY is not set in environment variables.",
            );
        }
    }

    private isAxiosError(
        error: unknown,
    ): error is AxiosError<GeminiErrorPayload> {
        return (
            typeof error === "object" &&
            error !== null &&
            (error as AxiosError).isAxiosError === true
        );
    }

    private hashText(input: string): string {
        return createHash("sha256").update(input).digest("hex");
    }

    private buildSummaryLogContext(
        request: GeminiSummaryRequest,
        prompt: string,
    ): {
        articleCount: number;
        totalTitleChars: number;
        totalContentChars: number;
        targetLanguage: string;
        promptLength: number;
        promptHash: string;
    } {
        const articles = request.articles ?? [];
        const totalTitleChars = articles.reduce(
            (sum, item) => sum + (item.title?.length ?? 0),
            0,
        );
        const totalContentChars = articles.reduce(
            (sum, item) => sum + (item.content?.length ?? 0),
            0,
        );

        return {
            articleCount: articles.length,
            totalTitleChars,
            totalContentChars,
            targetLanguage: request.targetLanguage ?? "auto",
            promptLength: prompt.length,
            promptHash: this.hashText(prompt),
        };
    }

    private buildScriptLogContext(
        request: GeminiScriptRequest,
        prompt: string,
    ): {
        summaryLength: number;
        articlesCount: number;
        promptLength: number;
        promptHash: string;
    } {
        const articles = request.articlesForContext ?? [];
        return {
            summaryLength: request.summaryText?.length ?? 0,
            articlesCount: articles.length,
            promptLength: prompt.length,
            promptHash: this.hashText(prompt),
        };
    }

    private async makeApiCall<TRequest extends object, TResponse>(
        // TRequest に object 制約を追加
        requestPayload: TRequest,
    ): Promise<AxiosResponse<TResponse>> {
        return await backOff(
            async () => {
                // backOffのコールバックもasyncにする
                return await firstValueFrom(
                    this.http.post<TResponse>(
                        `${this.apiUrl}?key=${this.apiKey}`,
                        requestPayload,
                        {
                            timeout: this.defaultTimeout,
                        },
                    ),
                );
            },
            {
                numOfAttempts: 4,
                startingDelay: 1000,
                timeMultiple: 3,
                retry: (e: unknown, attemptNumber: number) => {
                    // 修正: e の型を unknown に (lint/suspicious/noExplicitAny 関連)
                    this.logger.warn(
                        `LLM API call attempt ${attemptNumber} failed.`,
                    );
                    if (this.isAxiosError(e)) {
                        const status = e.response?.status;
                        // Gemini API のエラーレスポンス内の status フィールドも確認する
                        const geminiErrorStatus = e.response?.data?.status;

                        if (
                            status === 429 ||
                            geminiErrorStatus === "RESOURCE_EXHAUSTED"
                        ) {
                            this.logger.warn(
                                `Retrying due to 429/RESOURCE_EXHAUSTED. Attempt: ${attemptNumber}`,
                            );
                            return true;
                        }
                        if (status === 400) {
                            this.logger.error(
                                `Non-retriable error 400: ${e.response?.data?.message || e.message}`,
                            );
                            return false;
                        }
                        if (status && status >= 500) {
                            this.logger.warn(
                                `Retrying due to 5xx error. Status: ${status}. Attempt: ${attemptNumber}`,
                            );
                            return true;
                        }
                    }
                    this.logger.error(
                        `Unknown or non-retriable error during API call: ${e instanceof Error ? e.message : String(e)}`,
                    );
                    return false;
                },
            },
        ); // 修正: この関数は必ず値を返す (ts(2355) 関連)
    }

    public async generateSummary(
        request: GeminiSummaryRequest,
    ): Promise<GeminiSummaryResponse> {
        const articlesString = request.articles
            .map(
                (article) =>
                    // テンプレートリテラルに変更 (lint/style/useTemplate)
                    `Title: ${sanitizeMarkdown(article.title)}\nContent: ${sanitizeMarkdown(article.content.substring(0, 1000))}...\nURL: ${article.url}\nPublished: ${article.publishedAt}\n---`,
            )
            .join("\n\n");

        const langInstruction =
            request.targetLanguage === "ja"
                ? "日本語で記述してください。"
                : "英語で記述してください。";

        const prompt = `以下のRSS記事群の情報を元に、Markdown形式で簡潔なダイジェストを作成してください。${langInstruction}\n\n${articlesString}`;
        const logContext = this.buildSummaryLogContext(request, prompt);

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                topP: 0.9,
                maxOutputTokens: 4096,
            },
        };

        try {
            const startTime = Date.now();
            const res = await this.makeApiCall<object, GeminiApiResponse>(
                payload,
            );
            const duration = Date.now() - startTime;

            let responseText =
                res.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

            if (responseText.length > 7000) {
                this.logger.warn(
                    `Summary length ${responseText.length} exceeds 7000 chars, truncating.`,
                );
                responseText = `${responseText.substring(0, 7000)}... [truncated]`;
            }

            this.logger.log(
                `Summary generation successful: duration=${duration}ms, responseLength=${responseText.length}`,
            );

            return { content: responseText };
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            const errorDetails = this.isAxiosError(error)
                ? error.response?.data
                : error;
            this.logger.error(`Failed to generate summary: ${errorMessage}`, {
                error: errorDetails,
                request: logContext,
            });
            throw error;
        }
    }

    public async generateScript(
        request: GeminiScriptRequest,
    ): Promise<GeminiScriptResponse> {
        const systemInstruction =
            "あなたはプロのニュースキャスターです。自然で聞き取りやすい日本語のナレーション原稿を作成してください。";
        const articlesJsonString = request.articlesForContext
            ? `関連ニュース記事の概要JSON: ${JSON.stringify(request.articlesForContext.map((a) => ({ title: sanitizeMarkdown(a.title), url: a.url })))}`
            : "";

        // ユーザープロンプトにシステム指示を含めるアプローチ
        const userPrompt = `${systemInstruction}\n\n以下の要約文と、もしあれば関連ニュース記事の情報を元に、ニュース番組風の読み上げナレーション原稿を日本語で作成してください。各トピックを簡潔に紹介し、重要な情報を盛り込み、自然な流れで繋げてください。要約文: 「${sanitizeMarkdown(request.summaryText)}」 ${articlesJsonString}`; // 修正: useTemplate
        const logContext = this.buildScriptLogContext(request, userPrompt);

        const payload = {
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            // Google AI Studio (Gemini)のAPI Explorerで確認すると、
            // system_instruction をトップレベルで渡せる場合がある。
            // systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
            // または、 contents: [ {role: "system", ...}, {role: "user", ...} ] のように配列の先頭に。
            // ここではユーザープロンプトに含めたので、 generationConfig のみ。
            generationConfig: {
                temperature: 0.28,
                topP: 0.95,
                maxOutputTokens: 6000,
            },
        };

        try {
            const startTime = Date.now();
            const res = await this.makeApiCall<object, GeminiApiResponse>(
                payload,
            );
            const duration = Date.now() - startTime;

            let responseText =
                res.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

            if (responseText.length < 9000 || responseText.length > 12000) {
                this.logger.warn(
                    `Generated script length ${responseText.length} is outside the 9k-12k JP chars range.`,
                );
                if (responseText.length > 12000) {
                    responseText = `${responseText.substring(0, 12000)}... [truncated due to length limit]`; // 修正: useTemplate
                }
            }

            this.logger.log(
                `Script generation successful: duration=${duration}ms, responseLength=${responseText.length}`,
            );

            return { script: responseText };
        } catch (error: unknown) {
            // 修正: noExplicitAny
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            const errorDetails = this.isAxiosError(error)
                ? error.response?.data
                : error;
            this.logger.error(`Failed to generate script: ${errorMessage}`, {
                error: errorDetails,
                request: logContext,
            });
            throw error;
        }
    }
}
