export class FeedItemEntity {
    id!: number;
    user_subscription_id!: number;
    user_id!: string;
    title!: string;
    link!: string;
    link_hash!: string | null;
    description!: string | null;
    published_at!: Date | null;
    title_emb!: string | null;
    soft_deleted!: boolean;
    created_at!: Date;
    updated_at!: Date;

    constructor(
        data: Partial<FeedItemEntity> & {
            published_at?: string | Date | null;
            created_at?: string | Date;
            updated_at?: string | Date;
        } = {},
    ) {
        Object.assign(this, data);

        // 日付文字列をDateオブジェクトに変換
        if (data.published_at && typeof data.published_at === "string") {
            this.published_at = new Date(data.published_at);
        }
        if (data.created_at && typeof data.created_at === "string") {
            this.created_at = new Date(data.created_at);
        }
        if (data.updated_at && typeof data.updated_at === "string") {
            this.updated_at = new Date(data.updated_at);
        }
    }

    // ビジネスロジック: フィードアイテムが有効かどうかをチェック
    isActive(): boolean {
        return !this.soft_deleted;
    }

    // ビジネスロジック: タイトルと説明文が存在するかをチェック
    hasContent(): boolean {
        return !!(this.title && (this.description || "").length > 0);
    }

    // ビジネスロジック: 公開日が設定されているかをチェック
    hasPublishedDate(): boolean {
        return !!this.published_at;
    }

    // ビジネスロジック: 指定した期間内に公開されたかをチェック
    isPublishedWithinHours(hours: number): boolean {
        if (!this.published_at) return false;

        const publishedAt = new Date(this.published_at);
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffTime.getHours() - hours);
        return publishedAt >= cutoffTime;
    }

    // ビジネスロジック: ベクトル埋め込みが存在するかをチェック
    hasEmbedding(): boolean {
        return !!(this.title_emb && this.title_emb.length > 0);
    }

    // ビジネスロジック: 要約用のテキストコンテンツを取得
    getContentForSummary(): string {
        const title = this.title || "";
        const description = this.description || "";
        return `${title}\n\n${description}`.trim();
    }

    // ビジネスロジック: 短い説明文を取得（指定文字数で切り詰め）
    getTruncatedDescription(maxLength = 200): string {
        if (!this.description) return "";

        if (this.description.length <= maxLength) {
            return this.description;
        }

        return `${this.description.substring(0, maxLength)}...`;
    }

    // ビジネスロジック: リンクハッシュを生成
    generateLinkHash(): string {
        const crypto = require("node:crypto");
        return crypto.createHash("sha256").update(this.link).digest("hex");
    }

    // ビジネスロジック: 最近のアイテムかどうかをチェック（24時間以内）
    isRecent(): boolean {
        return this.isPublishedWithinHours(24);
    }
}
