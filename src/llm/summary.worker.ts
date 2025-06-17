import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { DailySummaryRepository } from './infrastructure/daily-summary.repository'
import { GeminiSummaryRequest, LLM_SERVICE, LlmService } from './llm.service'

export interface SummaryJobData {
    userId: string
    summaryDate: string
}

@Processor('summary-generate')
@Injectable()
export class SummaryWorker extends WorkerHost {
    private readonly logger = new Logger(SummaryWorker.name)

    constructor(
        private readonly dailySummaryRepository: DailySummaryRepository,
        @Inject(LLM_SERVICE) private readonly llmService: LlmService,
    ) {
        super()
    }

    async process(job: Job<SummaryJobData>) {
        const { userId, summaryDate } = job.data
        this.logger.log(`Processing summary job for user ${userId}, date ${summaryDate}`)

        try {
            // 既存の要約をチェック
            const existingSummary = await this.dailySummaryRepository.findByUserAndDate(
                userId,
                summaryDate,
            )
            if (existingSummary?.isCompleteSummary()) {
                this.logger.log(`Summary already exists for user ${userId}, date ${summaryDate}`)
                return { success: true, summaryId: existingSummary.id }
            }

            // 最新24時間のフィードアイテムを取得
            const feedItems = await this.dailySummaryRepository.getRecentFeedItems(userId, 24)

            if (feedItems.length === 0) {
                this.logger.log(`No feed items found for user ${userId}`)
                return { success: false, reason: 'No feed items found' }
            }

            // LLM用のリクエストデータを準備
            const summaryRequest: GeminiSummaryRequest = {
                articles: feedItems.map((item) => ({
                    title: item.title,
                    content: item.description || '',
                    url: item.link,
                    publishedAt: item.published_at,
                    language: this.detectLanguage(item.title, item.description),
                })),
                targetLanguage: this.determineTargetLanguage(feedItems),
            }

            // LLMで要約生成
            const summaryResponse = await this.llmService.generateSummary(summaryRequest)

            // 要約をデータベースに保存
            let summary = existingSummary
            if (summary) {
                summary = await this.dailySummaryRepository.update(summary.id, userId, {
                    markdown: summaryResponse.content,
                    summary_title: this.extractTitleFromMarkdown(summaryResponse.content),
                })
            } else {
                summary = await this.dailySummaryRepository.create(userId, summaryDate, {
                    markdown: summaryResponse.content,
                    summary_title: this.extractTitleFromMarkdown(summaryResponse.content),
                })
            }

            // フィードアイテムとの関連を保存
            const feedItemIds = feedItems.map((item) => item.id)
            await this.dailySummaryRepository.addSummaryItems(summary.id, userId, feedItemIds)

            this.logger.log(
                `Summary generated successfully for user ${userId}, summary ID: ${summary.id}`,
            )
            return { success: true, summaryId: summary.id }
        } catch (error) {
            this.logger.error(`Failed to process summary job: ${error.message}`, error.stack)
            throw error
        }
    }

    private detectLanguage(title: string, description = ''): string {
        const text = `${title} ${description}`.toLowerCase()
        // 簡単な日本語検出（ひらがな、カタカナ、漢字）
        const japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/
        return japaneseRegex.test(text) ? 'ja' : 'en'
    }

    private determineTargetLanguage(
        feedItems: {
            title: string
            description: string
        }[],
    ): 'ja' | 'en' {
        const japaneseCount = feedItems.filter(
            (item) => this.detectLanguage(item.title, item.description) === 'ja',
        ).length

        // 日本語記事が半数以上なら日本語、そうでなければ英語
        return japaneseCount >= feedItems.length / 2 ? 'ja' : 'en'
    }

    private extractTitleFromMarkdown(markdown: string): string {
        // マークダウンから最初のH1またはH2タイトルを抽出
        const titleMatch = markdown.match(/^#{1,2}\s+(.+)$/m)
        if (titleMatch) {
            return titleMatch[1].trim()
        }

        // タイトルが見つからない場合は最初の50文字を使用
        const plainText = markdown.replace(/[#*_`]/g, '').trim()
        return plainText.substring(0, 50) + (plainText.length > 50 ? '...' : '')
    }
}
