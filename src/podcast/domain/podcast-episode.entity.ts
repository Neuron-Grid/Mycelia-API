export class PodcastEpisodeEntity {
    id!: number;
    user_id!: string;
    summary_id!: number;
    title!: string;
    title_emb!: string | null;
    audio_url!: string;
    soft_deleted!: boolean;
    created_at!: string;
    updated_at!: string;

    constructor(data: Partial<PodcastEpisodeEntity> = {}) {
        Object.assign(this, data);

        this.title = data.title ?? "";
        this.audio_url = data.audio_url ?? "";
    }

    // ビジネスロジック: エピソードが完成しているかチェック
    isComplete(): boolean {
        return !!(this.title && this.audio_url);
    }

    // ビジネスロジック: 音声ファイルが存在するかチェック
    hasAudio(): boolean {
        return !!this.audio_url;
    }

    // ビジネスロジック: タイトルが設定されているかチェック
    hasTitle(): boolean {
        return !!this.title;
    }

    // ビジネスロジック: Cloudflare R2のファイル名を取得
    getAudioFileName(): string | null {
        if (!this.audio_url) return null;

        try {
            const url = new URL(this.audio_url);
            const pathParts = url.pathname.split("/");
            return pathParts[pathParts.length - 1];
        } catch {
            return null;
        }
    }

    // ビジネスロジック: エピソードの期間をメタデータから推定
    estimateDurationFromTitle(): number | null {
        if (!this.title) return null;

        // タイトルから時間情報を抽出（例：「15分のニュース要約」）
        const durationMatch = this.title.match(/(\d+)分/);
        return durationMatch
            ? Number.parseInt(durationMatch[1], 10) * 60
            : null;
    }
}
