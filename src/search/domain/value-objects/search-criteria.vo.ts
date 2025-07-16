export interface SearchCriteriaData {
    query: string;
    limit?: number;
    threshold?: number;
    includeTypes?: ("feed_item" | "summary" | "podcast")[];
}

export class SearchCriteria {
    public readonly query: string;
    public readonly limit: number;
    public readonly threshold: number;
    public readonly includeTypes: ("feed_item" | "summary" | "podcast")[];

    constructor(data: SearchCriteriaData) {
        if (!data.query || data.query.trim().length === 0) {
            throw new Error("Search query cannot be empty");
        }

        this.query = data.query.trim();
        this.limit = this.validateLimit(data.limit);
        this.threshold = this.validateThreshold(data.threshold);
        this.includeTypes = data.includeTypes || [
            "feed_item",
            "summary",
            "podcast",
        ];
    }

    private validateLimit(limit?: number): number {
        const defaultLimit = 20;
        if (limit === undefined) return defaultLimit;
        if (limit < 1) return 1;
        if (limit > 100) return 100;
        return Math.floor(limit);
    }

    private validateThreshold(threshold?: number): number {
        const defaultThreshold = 0.7;
        if (threshold === undefined) return defaultThreshold;
        if (threshold < 0) return 0;
        if (threshold > 1) return 1;
        return threshold;
    }

    shouldIncludeFeedItems(): boolean {
        return this.includeTypes.includes("feed_item");
    }

    shouldIncludeSummaries(): boolean {
        return this.includeTypes.includes("summary");
    }

    shouldIncludePodcasts(): boolean {
        return this.includeTypes.includes("podcast");
    }

    getLimitPerType(): number {
        return Math.ceil(this.limit / this.includeTypes.length);
    }
}
