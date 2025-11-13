import { HttpService } from "@nestjs/axios";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { APP_ENV_TOKEN, type AppEnv } from "@/config/app-env";

// Gemini 2.5 Flash Preview API クライアントサービス
// - script_text, summary_text 生成用
@Injectable()
export class GeminiService {
    private readonly logger = new Logger(GeminiService.name);
    private readonly apiUrl: string;
    private readonly apiKey: string;

    constructor(
        private readonly http: HttpService,
        @Inject(APP_ENV_TOKEN) private readonly appEnv: AppEnv,
    ) {
        const { apiUrl, apiKey } = this.appEnv.getGeminiConfig();
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
    }

    // Gemini 2.5 Flashで台本（script_text）を生成
    // @param prompt プロンプト
    // @param maxTokens 最大トークン数
    // @returns script_text
    async generateScriptText(
        prompt: string,
        maxTokens = 2048,
    ): Promise<string> {
        if (!this.apiKey) {
            throw new Error("GEMINI_API_KEY is not set");
        }

        try {
            const res = await firstValueFrom(
                this.http.post(
                    this.apiUrl,
                    {
                        contents: [{ role: "user", parts: [{ text: prompt }] }],
                        generationConfig: {
                            maxOutputTokens: maxTokens,
                            temperature: 0.7,
                            topP: 0.95,
                        },
                    },
                    {
                        headers: { "x-goog-api-key": this.apiKey },
                        timeout: 30000,
                    },
                ),
            );

            // Gemini API レスポンスから script_text を抽出
            const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new Error("Gemini API response missing script_text");
            }

            return text;
        } catch (err) {
            this.logger.error(`Gemini script_text generation failed: ${err}`);
            throw err;
        }
    }
}
