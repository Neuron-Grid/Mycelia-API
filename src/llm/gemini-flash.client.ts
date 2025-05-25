import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config' // ConfigService をインポート
import { AxiosError, AxiosResponse } from 'axios'
import { backOff } from 'exponential-backoff'
import { firstValueFrom } from 'rxjs'
import sanitizeMarkdown from 'sanitize-markdown'
import {
    GeminiScriptRequest,
    GeminiScriptResponse,
    GeminiSummaryRequest,
    GeminiSummaryResponse,
    LlmService,
} from './llm.service'

interface GeminiApiResponseCandidate {
    content?: {
        parts?: Array<{ text?: string }>
        role?: string
    }
    finishReason?: string
    // ... other fields
}
interface GeminiApiResponse {
    candidates?: Array<GeminiApiResponseCandidate>
    usageMetadata?: {
        promptTokenCount?: number
        candidatesTokenCount?: number
        totalTokenCount?: number
    }
    // promptFeedback?: ...
}

interface GeminiErrorDetail {
    // Gemini APIが返す可能性のあるエラー詳細構造
    '@type'?: string
    reason?: string // 例: "API_KEY_INVALID"
    domain?: string
    metadata?: Record<string, unknown>
}

interface GeminiErrorPayload {
    // Gemini APIの実際のエラーレスポンスの'error'フィールド
    code?: number // HTTPステータスとは別の内部エラーコード
    message?: string
    status?: string // 例: "INVALID_ARGUMENT", "RESOURCE_EXHAUSTED"
    details?: GeminiErrorDetail[]
}

@Injectable()
export class GeminiFlashClient implements LlmService {
    public logger = new Logger(GeminiFlashClient.name)
    public readonly apiUrl: string
    public readonly apiKey: string
    public readonly defaultTimeout = 30000

    constructor(
        public readonly http: HttpService,
        private readonly configService: ConfigService, // ConfigService を注入
    ) {
        this.apiUrl =
            this.configService.get<string>('GEMINI_API_URL') ||
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-latest:generateContent'
        this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || ''

        if (!this.apiKey) {
            this.logger.error('GEMINI_API_KEY is not set')
            throw new Error('GEMINI_API_KEY is not set in environment variables.')
        }
    }

    private isAxiosError(error: unknown): error is AxiosError<GeminiErrorPayload> {
        return (
            typeof error === 'object' &&
            error !== null &&
            (error as AxiosError).isAxiosError === true
        )
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
                        { timeout: this.defaultTimeout },
                    ),
                )
            },
            {
                numOfAttempts: 4,
                startingDelay: 1000,
                timeMultiple: 3,
                retry: (e: unknown, attemptNumber: number) => {
                    // 修正: e の型を unknown に (lint/suspicious/noExplicitAny 関連)
                    this.logger.warn(`LLM API call attempt ${attemptNumber} failed.`)
                    if (this.isAxiosError(e)) {
                        const status = e.response?.status
                        // Gemini API のエラーレスポンス内の status フィールドも確認する
                        const geminiErrorStatus = e.response?.data?.status

                        if (status === 429 || geminiErrorStatus === 'RESOURCE_EXHAUSTED') {
                            this.logger.warn(
                                `Retrying due to 429/RESOURCE_EXHAUSTED. Attempt: ${attemptNumber}`,
                            )
                            return true
                        }
                        if (status === 400) {
                            this.logger.error(
                                `Non-retriable error 400: ${e.response?.data?.message || e.message}`,
                            )
                            return false
                        }
                        if (status && status >= 500) {
                            this.logger.warn(
                                `Retrying due to 5xx error. Status: ${status}. Attempt: ${attemptNumber}`,
                            )
                            return true
                        }
                    }
                    this.logger.error(
                        `Unknown or non-retriable error during API call: ${e instanceof Error ? e.message : String(e)}`,
                    )
                    return false
                },
            },
        ) // 修正: この関数は必ず値を返す (ts(2355) 関連)
    }

    public async generateSummary(request: GeminiSummaryRequest): Promise<GeminiSummaryResponse> {
        const articlesString = request.articles
            .map(
                (article) =>
                    // テンプレートリテラルに変更 (lint/style/useTemplate)
                    `Title: ${sanitizeMarkdown(article.title)}\nContent: ${sanitizeMarkdown(article.content.substring(0, 1000))}...\nURL: ${article.url}\nPublished: ${article.publishedAt}\n---`,
            )
            .join('\n\n')

        const langInstruction =
            request.targetLanguage === 'ja'
                ? '日本語で記述してください。'
                : '英語で記述してください。'

        const prompt = `以下のRSS記事群の情報を元に、Markdown形式で簡潔なダイジェストを作成してください。${langInstruction}\n\n${articlesString}`

        const payload = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                topP: 0.9,
                maxOutputTokens: 4096,
            },
        }

        try {
            const res = await this.makeApiCall<object, GeminiApiResponse>(payload)
            let responseText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

            if (responseText.length > 7000) {
                this.logger.warn(
                    `Summary length ${responseText.length} exceeds 7000 chars, truncating.`,
                )
                responseText = `${responseText.substring(0, 7000)}... [truncated]`
            }

            return { content: responseText }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            const errorDetails = this.isAxiosError(error) ? error.response?.data : error
            this.logger.error(`Failed to generate summary: ${errorMessage}`, errorDetails)
            throw error
        }
    }

    public async generateScript(request: GeminiScriptRequest): Promise<GeminiScriptResponse> {
        const systemInstruction =
            'あなたはプロのニュースキャスターです。自然で聞き取りやすい日本語のナレーション原稿を作成してください。'
        const articlesJsonString = request.articlesForContext
            ? `関連ニュース記事の概要JSON: ${JSON.stringify(request.articlesForContext.map((a) => ({ title: sanitizeMarkdown(a.title), url: a.url })))}`
            : ''

        // ユーザープロンプトにシステム指示を含めるアプローチ
        const userPrompt = `${systemInstruction}\n\n以下の要約文と、もしあれば関連ニュース記事の情報を元に、ニュース番組風の読み上げナレーション原稿を日本語で作成してください。各トピックを簡潔に紹介し、重要な情報を盛り込み、自然な流れで繋げてください。要約文: 「${sanitizeMarkdown(request.summaryText)}」 ${articlesJsonString}` // 修正: useTemplate

        const payload = {
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
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
        }

        try {
            const res = await this.makeApiCall<object, GeminiApiResponse>(payload)
            let responseText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

            if (responseText.length < 9000 || responseText.length > 12000) {
                this.logger.warn(
                    `Generated script length ${responseText.length} is outside the 9k-12k JP chars range.`,
                )
                if (responseText.length > 12000) {
                    responseText = `${responseText.substring(0, 12000)}... [truncated due to length limit]` // 修正: useTemplate
                }
            }
            return { script: responseText }
        } catch (error: unknown) {
            // 修正: noExplicitAny
            const errorMessage = error instanceof Error ? error.message : String(error)
            const errorDetails = this.isAxiosError(error) ? error.response?.data : error
            this.logger.error(`Failed to generate script: ${errorMessage}`, errorDetails)
            throw error
        }
    }
    // 以下の未使用変数のエラー箇所は、この修正版では該当する変数が使用されているか、
    // または前回の修正で既に削除されているため、直接的な修正は不要。
    // 164, startColumn: 15, endLineNumber: 164, endColumn: 32 (articlesForContext) --> articlesJsonString で使用
    // 165, startColumn: 15, endLineNumber: 165, endColumn: 33 (systemInstructionForUserPrompt) --> userPrompt に統合
    // 169, startColumn: 15, endLineNumber: 169, endColumn: 25 (apiPayload) --> payload にリネームして使用

    // 169行目のテンプレートリテラルに関するエラー群は、その行のコードが修正・削除されたため解消されるはず。
    // "unterminated template literal" や "expected `}`" は、通常、文字列の閉じ忘れや構文ミスが原因。
    // この修正版では、該当する可能性のある箇所は見当たらない。
    // もし残っている場合は、具体的なコード行と合わせて再確認が必要。
}
