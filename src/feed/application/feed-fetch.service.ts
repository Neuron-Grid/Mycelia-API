// @file RSSフィードの取得とパースを行うサービス
import { Injectable } from "@nestjs/common";
// @see https://www.npmjs.com/package/feedparser
import FeedParser, { Item as FeedparserItem, Meta } from "feedparser";
// @see https://www.npmjs.com/package/node-fetch
import fetch, { Response } from "node-fetch";

@Injectable()
// @public
// @since 1.0.0
export class FeedFetchService {
    // @async
    // @public
    // @since 1.0.0
    // @param {string} feedUrl - RSSフィードのURL
    // @returns {Promise<{ meta: Meta; items: FeedparserItem[] }>} - パース結果（メタ情報とアイテム配列）
    // @throws {Error} - フィード取得やパースに失敗した場合
    // @example
    // const { meta, items } = await feedFetchService.parseFeed('https://example.com/rss')
    // @see FeedParser
    parseFeed(
        feedUrl: string,
    ): Promise<{ meta: Meta; items: FeedparserItem[] }> {
        const feedparser = new FeedParser({ normalize: true });
        const items: FeedparserItem[] = [];
        let meta: Meta = {} as Meta;

        return new Promise((resolve, reject) => {
            fetch(feedUrl)
                .then((res: Response) => {
                    if (res.status !== 200) {
                        reject(new Error(`Bad status code: ${res.status}`));
                        return;
                    }
                    if (!res.body) {
                        reject(new Error("Response body is null"));
                        return;
                    }
                    res.body.pipe(feedparser);
                })
                .catch((err) => {
                    reject(err);
                });

            feedparser.on("error", (error: Error) => {
                reject(error);
            });

            feedparser.on("meta", function () {
                meta = this.meta;
            });

            feedparser.on("readable", function (this: FeedParser) {
                let item: FeedparserItem | null;
                while (true) {
                    item = this.read();
                    if (!item) {
                        break;
                    }
                    items.push(item);
                }
            });

            feedparser.on("end", () => {
                resolve({ meta, items });
            });
        });
    }
}
