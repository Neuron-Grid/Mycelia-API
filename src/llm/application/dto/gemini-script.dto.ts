export interface GeminiScriptRequest {
    summaryText: string;
    articlesForContext?: Array<{
        title: string;
        url: string;
    }>;
}

export interface GeminiScriptResponse {
    script: string;
}
