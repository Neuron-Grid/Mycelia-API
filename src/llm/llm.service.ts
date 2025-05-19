// src/llm/llm.service.ts

// --- DTOs ---
// 仕様書では LlmService のメソッド引数はシンプルなため、
// DTOはワーカーがクライアントに渡す際の内部的な型として使用するか、
// ワーカーへのキューイング時のデータ構造として明確化する。
// ここでは、LLMクライアント(GeminiFlashClient)が受け取るデータ構造として定義する。

export interface GeminiSummaryRequest {
    articles: Array<{ // この記事データはワーカーがuserIdから取得して渡す
        title: string;
        content: string; // 主要な本文コンテント
        url: string;
        publishedAt: string; // ISO8601
        language: string; // 'ja' | 'en' など
    }>;
    targetLanguage?: 'ja' | 'en'; // 仕様書: "JP if feed JP else EN" の実現のため
}

export interface GeminiSummaryResponse {
    content: string; // Markdown digest (仕様書: SummaryText)
    // tokenCount, charLength などは内部的な情報として扱うか、必要なら追加
}

export interface GeminiScriptRequest {
    summaryText: string; // このサマリーテキストはワーカーがsummaryIdから取得して渡す
    articlesForContext?: Array<{ // 仕様書 <articles JSON> に対応
        title: string;
        url: string; // 例
    }>;
    // targetLanguage は仕様書で "Always JP narration" なので固定
}

export interface GeminiScriptResponse {
    script: string; // Spoken narration (仕様書: ScriptText)
    // ttsDurationSec はここでは生成しない (TTSサービス後にDB更新)
}


// --- LLM Service Interface ---
// このインターフェースは、GeminiFlashClientが実装する。
// 引数は、ワーカーが必要な情報を収集した上でクライアントに渡すデータを想定。
export interface LlmService {
    generateSummary(request: GeminiSummaryRequest): Promise<GeminiSummaryResponse>;
    generateScript(request: GeminiScriptRequest): Promise<GeminiScriptResponse>;
}

export const LLM_SERVICE = Symbol('LlmService');