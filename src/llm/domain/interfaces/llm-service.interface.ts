import type {
    GeminiScriptRequest,
    GeminiScriptResponse,
    GeminiSummaryRequest,
    GeminiSummaryResponse,
} from '../../application/dto'

export interface LlmService {
    generateSummary(request: GeminiSummaryRequest): Promise<GeminiSummaryResponse>
    generateScript(request: GeminiScriptRequest): Promise<GeminiScriptResponse>
}

export const LLM_SERVICE = Symbol('LlmService')
