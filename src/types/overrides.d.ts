import type { Database, TablesInsert } from "./schema";

/**
 * tags.path 列の lt ree 型をアプリケーション層で扱いやすい string に補正した型。
 */
export type TagsRow = Omit<
    Database["public"]["Tables"]["tags"]["Row"],
    "path"
> & {
    path: string;
};

export type TagsInsert = Omit<
    Database["public"]["Tables"]["tags"]["Insert"],
    "path"
> & {
    path?: string | null;
};

export type TagsUpdate = Omit<
    Database["public"]["Tables"]["tags"]["Update"],
    "path"
> & {
    path?: string | null;
};

/**
 * RLSトリガーでlink_hashが計算されるため、InsertPayloadでは除外して利用する。
 */
export type FeedItemsInsertWithoutHash = Omit<
    TablesInsert<"feed_items">,
    "link_hash"
>;
