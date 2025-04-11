import { Injectable, Logger } from '@nestjs/common'
import * as FeedParser from 'feedparser'
import { Item as FeedparserItem, Meta } from 'feedparser'
import fetch, { Response } from 'node-fetch'
import { SupabaseRequestService } from 'src/supabase-request.service'

@Injectable()
export class FeedService {
    private readonly logger = new Logger(FeedService.name)

    constructor(private readonly supabaseRequestService: SupabaseRequestService) {}

    // userIdに紐づく購読一覧を取得
    async getSubscriptionsByUserId(userId: string) {
        const supabase = this.supabaseRequestService.getClient()
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)

        if (error) {
            this.logger.error(`Failed to get subscriptions: ${error.message}`, error)
            throw error
        }
        return data
    }

    // 新規購読を追加
    async addSubscription(userId: string, feedUrl: string) {
        const supabase = this.supabaseRequestService.getClient()
        let feedTitle = ''

        try {
            const feedData = await this.parseFeedWithFeedParser(feedUrl)
            // feedparserのmeta.titleを最大100文字にトリム
            feedTitle = feedData.meta.title?.substring(0, 100) || ''
        } catch (err) {
            // タイトル取得だけ失敗しても登録は続行したい
            this.logger.warn(`Could not fetch feed title from ${feedUrl}: ${err}`)
        }

        const { data, error } = await supabase
            .from('user_subscriptions')
            .insert({
                user_id: userId,
                feed_url: feedUrl,
                feed_title: feedTitle,
            })
            .select()
            .single()

        if (error) {
            this.logger.error(`Failed to insert subscription: ${error.message}`, error)
            throw error
        }
        return data
    }

    // subscriptionIdをキーに購読を1件取得
    async getSubscriptionById(userId: string, subscriptionId: number) {
        const supabase = this.supabaseRequestService.getClient()
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('id', subscriptionId)
            .single()
        if (error) {
            throw error
        }
        return data
    }

    // 指定の購読に紐づくフィードアイテム一覧を取得
    async getFeedItems(userId: string, subscriptionId: number) {
        const supabase = this.supabaseRequestService.getClient()
        const { data, error } = await supabase
            .from('feed_items')
            .select('*')
            .eq('user_subscription_id', subscriptionId)
            .eq('user_id', userId)
            .order('published_at', { ascending: false })

        if (error) {
            this.logger.error(`Failed to get feed_items: ${error.message}`, error)
            throw error
        }
        return data
    }

    // 購読をフェッチし、新着アイテムをDBに保存
    async fetchFeedItems(subscriptionId: number, userId: string) {
        const supabase = this.supabaseRequestService.getClient()

        // user_subscriptionsから feedUrl / refresh_interval 取得
        const { data: subscription, error: subError } = await supabase
            .from('user_subscriptions')
            .select('feed_url, refresh_interval, feed_title')
            .eq('id', subscriptionId)
            .eq('user_id', userId)
            .single()

        if (subError || !subscription) {
            throw new Error(`Subscription not found (ID=${subscriptionId}, user_id=${userId})`)
        }
        const { feed_url, refresh_interval } = subscription

        // RSSを取得 + パース
        let feedData: { meta: Meta; items: FeedparserItem[] }
        try {
            feedData = await this.parseFeedWithFeedParser(feed_url)
        } catch (error) {
            this.logger.error(`Failed to parse RSS feed: ${feed_url}`, error)
            throw error
        }

        // フィードタイトルが取得できなかった場合はDBにある既存値を使う
        const feedTitle = feedData.meta.title ?? subscription.feed_title

        // 新着アイテムを feed_items にinsert
        // unique制約で重複した場合はスキップ
        let insertedCount = 0
        for (const item of feedData.items) {
            const link: string = item.link ?? ''
            if (!link) continue

            // feedparser だと pubDate / date / summary などが使われる事が多い
            const title = item.title ?? '(no title)'
            const published_at = item.pubdate ? new Date(item.pubdate) : null
            const description = item.summary ?? item.description ?? ''

            try {
                const { error: insertError } = await supabase.from('feed_items').insert({
                    user_subscription_id: subscriptionId,
                    user_id: userId,
                    title: title.substring(0, 1024),
                    link: link.substring(0, 2048),
                    description,
                    published_at,
                })

                if (!insertError) {
                    insertedCount++
                } else if (insertError.message.includes('duplicate key')) {
                    this.logger.verbose(`Duplicate link skipped: ${link}`)
                } else {
                    this.logger.warn(`Insert error: ${insertError.message}`)
                }
            } catch (err) {
                this.logger.warn(`Failed to insert feed item: ${link} : ${err}`)
            }
        }

        // last_fetched_at, next_fetch_at 更新
        const lastFetchedAt = new Date()
        const nextFetchAt = this.calcNextFetchTime(lastFetchedAt, refresh_interval || '30minute')
        await supabase
            .from('user_subscriptions')
            .update({
                last_fetched_at: lastFetchedAt.toISOString(),
                next_fetch_at: nextFetchAt.toISOString(),
            })
            .eq('id', subscriptionId)
            .eq('user_id', userId)

        return {
            feedTitle,
            insertedCount,
            lastFetchedAt,
            nextFetchAt,
        }
    }

    // feedparserを用いてRSS/Atomフィードをパースするヘルパー
    // @param feedUrl 取得先URL
    // @returns Promise<{ meta: Meta; items: FeedparserItem[] }>
    private async parseFeedWithFeedParser(
        feedUrl: string,
    ): Promise<{ meta: Meta; items: FeedparserItem[] }> {
        // FeedParser はストリームを継承したクラス
        const feedparser = new FeedParser({ normalize: true })
        const items: FeedparserItem[] = []
        // meta はFeedParserが解析したフィードのメタ情報
        let meta: Meta = {} as Meta

        return new Promise((resolve, reject) => {
            // HTTPリクエスト
            fetch(feedUrl)
                .then((res: Response) => {
                    if (res.status !== 200) {
                        reject(new Error(`Bad status code: ${res.status}`))
                        return
                    }
                    if (!res.body) {
                        reject(new Error('Response body is null'))
                        return
                    }
                    res.body.pipe(feedparser)
                })
                .catch((err) => {
                    reject(err)
                })

            // feedparserのイベント設定
            feedparser.on('error', (error: Error) => {
                reject(error)
            })

            // フィードのメタデータ
            feedparser.on('meta', function () {
                // 'this' はfeedparserインスタンスを指す
                meta = this.meta
            })

            // アイテムを逐次読み込む
            feedparser.on('readable', function (this: FeedParser) {
                let item: FeedparserItem | null
                while (true) {
                    item = this.read()
                    if (!item) {
                        break
                    }
                    items.push(item)
                }
            })

            // 全読み込み完了
            feedparser.on('end', () => {
                resolve({ meta, items })
            })
        })
    }

    // refresh_interval_enum に従い次回フェッチ時刻を計算
    private calcNextFetchTime(fromDate: Date, interval: string): Date {
        const next = new Date(fromDate)
        const map: Record<string, number> = {
            '5minute': 5,
            '10minute': 10,
            '30minute': 30,
            '1hour': 60,
            '2hour': 120,
            '4hour': 240,
            '6hour': 360,
            '12hour': 720,
        }
        const minutes = map[interval] ?? 30
        next.setMinutes(next.getMinutes() + minutes)
        return next
    }
}
