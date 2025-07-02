export interface SearchResultEntity {
    id: number
    title: string
    content: string
    similarity: number
    type: 'feed_item' | 'summary' | 'podcast'
    metadata?: Record<string, string | number | boolean | null>
}

export class SearchResult implements SearchResultEntity {
    constructor(
        public readonly id: number,
        public readonly title: string,
        public readonly content: string,
        public readonly similarity: number,
        public readonly type: 'feed_item' | 'summary' | 'podcast',
        public readonly metadata?: Record<string, string | number | boolean | null>,
    ) {}

    isFeedItem(): boolean {
        return this.type === 'feed_item'
    }

    isSummary(): boolean {
        return this.type === 'summary'
    }

    isPodcast(): boolean {
        return this.type === 'podcast'
    }

    hasHighSimilarity(threshold = 0.8): boolean {
        return this.similarity >= threshold
    }
}
