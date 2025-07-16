export interface GeminiSummaryRequest {
    articles: Array<{
        title: string;
        content: string;
        url: string;
        publishedAt: string;
        language: string;
    }>;
    targetLanguage?: 'ja' | 'en';
}

export interface GeminiSummaryResponse {
    content: string;
}
