import { Injectable, Logger } from '@nestjs/common'
import * as FeedParser from 'feedparser'
import { Item as FeedparserItem, Meta } from 'feedparser'
import fetch, { Response } from 'node-fetch'

@Injectable()
export class FeedFetchService {
    private readonly logger = new Logger(FeedFetchService.name)

    // RSSをfetchしてFeedParserでパースし、メタ情報とアイテム配列を返す
    async parseFeed(feedUrl: string): Promise<{ meta: Meta; items: FeedparserItem[] }> {
        const feedparser = new FeedParser({ normalize: true })
        const items: FeedparserItem[] = []
        let meta: Meta = {} as Meta

        return new Promise((resolve, reject) => {
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

            feedparser.on('error', (error: Error) => {
                reject(error)
            })

            feedparser.on('meta', function () {
                meta = this.meta
            })

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

            feedparser.on('end', () => {
                resolve({ meta, items })
            })
        })
    }
}
