export class DailySummaryEntity {
    id!: number
    user_id!: string
    summary_date!: string
    markdown!: string | null
    summary_title!: string | null
    summary_embedding!: number[] | null
    script_text!: string | null
    script_tts_duration_sec!: number | null
    soft_deleted!: boolean
    created_at!: string
    updated_at!: string

    constructor(data: Partial<DailySummaryEntity> = {}) {
        Object.assign(this, data)
    }

    // ビジネスロジック: 要約が完成しているかチェック
    isCompleteSummary(): boolean {
        return !!(this.markdown && this.summary_title)
    }

    // ビジネスロジック: スクリプトが生成済みかチェック
    hasScript(): boolean {
        return !!this.script_text
    }

    // ビジネスロジック: TTSが完了しているかチェック
    hasAudio(): boolean {
        return !!(this.script_text && this.script_tts_duration_sec)
    }

    // ビジネスロジック: 指定された日付範囲内かチェック
    isWithinDateRange(startDate: Date, endDate: Date): boolean {
        const summaryDate = new Date(this.summary_date)
        return summaryDate >= startDate && summaryDate <= endDate
    }
}

export class DailySummaryItemEntity {
    summary_id!: number
    feed_item_id!: number

    constructor(data: Partial<DailySummaryItemEntity> = {}) {
        Object.assign(this, data)
    }
}
