import { Injectable, Logger } from '@nestjs/common'
import {
    GeminiScriptRequest,
    GeminiScriptResponse,
    GeminiSummaryRequest,
    GeminiSummaryResponse,
    LlmService,
} from './llm.service'

@Injectable()
export class MockLlmService implements LlmService {
    private readonly logger = new Logger(MockLlmService.name)

    // 要約を生成するモック実装
    // @param request GeminiSummaryRequest (旧 SummaryRequestDto)
    // @returns モックの要約結果 (GeminiSummaryResponse)
    async generateSummary(request: GeminiSummaryRequest): Promise<GeminiSummaryResponse> {
        // request.articles を使って何かログ出力やダミーロジックを入れることも可能
        this.logger.debug(
            `Generating mock summary for articles count: ${request.articles.length}, target language: ${request.targetLanguage || 'auto'}`,
        )
        return await Promise.resolve({
            // GeminiSummaryResponse に合わせる
            content:
                '## Mock Summary\n- This is a mock summary for the provided articles.\n\n**Sources:**\nhttps://example.com/article1',
            // 以前の MockLlmService にあったフィールドは、新しい GeminiSummaryResponse には必須ではない
            // 必要であれば、GeminiSummaryResponse に追加するか、モックでのみ返す追加情報として扱う
            // sources: ['https://example.com/article1'], // content内に含めるか、別途フィールドを定義
            // charLength: 80,
            // tokenCount: 20,
            // truncated: false,
        })
    }

    // 台本を生成するモック実装
    // @param request GeminiScriptRequest (旧 ScriptRequestDto)
    // @returns モックの台本結果 (GeminiScriptResponse)
    async generateScript(request: GeminiScriptRequest): Promise<GeminiScriptResponse> {
        // request.summaryText や request.articlesForContext を使ってログ出力
        this.logger.debug(
            `Generating mock script based on summary: "${request.summaryText.substring(0, 30)}..."`,
        )
        if (request.articlesForContext && request.articlesForContext.length > 0) {
            this.logger.debug(`Using ${request.articlesForContext.length} articles for context.`)
        }
        return await Promise.resolve({
            // GeminiScriptResponse に合わせる
            script: 'これはモック台本です。[pause]\nThis is a mock script. [pause] この台本は提供された要約に基づいて作成されました。',
            // 以前の MockLlmService にあったフィールド
            // charLength: 70,
            // wordCount: 15,
            // truncated: false,
        })
    }
}
