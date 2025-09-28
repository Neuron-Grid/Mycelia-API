/**
 * feed_items.link_hashトリガーのE2E検証。
 * 正規化: canonical_urlが存在すれば優先し、なければlinkをtrim → lower → UTF-8でSHA256。
 * 一意制約: UNIQUE (user_subscription_id, link_hash)。
 */

import { randomUUID } from "node:crypto";
import { jest } from "@jest/globals";
import { ConfigService } from "@nestjs/config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";

import { FeedItemRepository } from "@/feed/infrastructure/feed-item.repository";
import { SupabaseRequestService } from "@/supabase-request.service";
import type { FeedItemsInsertWithoutHash } from "@/types/overrides";
import type { Database } from "@/types/schema";

import { computeExpectedHash, isValidLinkHash } from "./utils/hash";

jest.setTimeout(45_000);

describe("feed_items link_hash trigger (e2e)", () => {
    const config = new ConfigService();
    const supabaseUrl = config.get<string>("SUPABASE_URL");
    const anonKey = config.get<string>("SUPABASE_ANON_KEY");
    const serviceRoleKey = config.get<string>("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAvailable = Boolean(supabaseUrl && anonKey && serviceRoleKey);
    const describeOrSkip = supabaseAvailable ? describe : describe.skip;
    if (!supabaseAvailable) {
        // CI環境などSupabase接続情報が無い場合はスキップする。
        console.warn(
            "feed_items E2E: SUPABASE_URL/ANON/SERVICE_ROLE が未設定のためスキップ",
        );
    }

    describeOrSkip("feed_items link_hash trigger (e2e)", () => {
        const resolvedSupabaseUrl = supabaseUrl as string;
        const resolvedAnonKey = anonKey as string;
        const resolvedServiceRoleKey = serviceRoleKey as string;

        const PUBLISHED_AT = "2024-01-01T00:00:00.000Z";

        type FeedItemRow = Database["public"]["Tables"]["feed_items"]["Row"];
        type FeedItemInsertPayload = Parameters<
            FeedItemRepository["insertFeedItem"]
        >[0];

        let adminClient: SupabaseClient<Database>;
        let anonClient: SupabaseClient<Database>;
        let accessToken: string;
        let testUserId: string;
        let primarySubscriptionId: number;
        let secondarySubscriptionId: number;
        let testEmail: string;
        let testPassword: string;

        beforeAll(async () => {
            adminClient = createClient<Database>(
                resolvedSupabaseUrl,
                resolvedServiceRoleKey,
                {
                    auth: { autoRefreshToken: false, persistSession: false },
                },
            );
            anonClient = createClient<Database>(
                resolvedSupabaseUrl,
                resolvedAnonKey,
                {
                    auth: { autoRefreshToken: false, persistSession: false },
                },
            );

            const suffix = randomUUID();
            testEmail = `feed-items-e2e-${suffix}@example.com`;
            testPassword = `Passw0rd!${suffix.slice(0, 8)}`;
            const username = `feed_items_e2e_${suffix.slice(0, 8)}`;

            const { data: userData, error: createUserError } =
                await adminClient.auth.admin.createUser({
                    email: testEmail,
                    password: testPassword,
                    email_confirm: true,
                    user_metadata: { username },
                });
            if (createUserError || !userData?.user?.id) {
                throw (
                    createUserError ?? new Error("ユーザー作成に失敗しました")
                );
            }
            testUserId = userData.user.id;

            const { data: primarySub, error: primarySubError } =
                await adminClient
                    .from("user_subscriptions")
                    .insert({
                        user_id: testUserId,
                        feed_url: `https://example.com/e2e/${suffix}`,
                        feed_title: "E2E Primary",
                    })
                    .select("id")
                    .single();
            if (primarySubError || !primarySub?.id) {
                throw (
                    primarySubError ??
                    new Error("user_subscriptions作成に失敗しました")
                );
            }
            primarySubscriptionId = primarySub.id;

            const { data: secondarySub, error: secondarySubError } =
                await adminClient
                    .from("user_subscriptions")
                    .insert({
                        user_id: testUserId,
                        feed_url: `https://example.com/e2e/${suffix}/secondary`,
                        feed_title: "E2E Secondary",
                    })
                    .select("id")
                    .single();
            if (secondarySubError || !secondarySub?.id) {
                throw (
                    secondarySubError ??
                    new Error("secondary user_subscriptions作成に失敗しました")
                );
            }
            secondarySubscriptionId = secondarySub.id;

            const { data: signInData, error: signInError } =
                await anonClient.auth.signInWithPassword({
                    email: testEmail,
                    password: testPassword,
                });
            if (signInError || !signInData.session?.access_token) {
                throw (
                    signInError ??
                    new Error("テストユーザーのサインインに失敗しました")
                );
            }
            accessToken = signInData.session.access_token;
        });

        afterEach(async () => {
            await adminClient
                .from("feed_items")
                .delete()
                .eq("user_subscription_id", primarySubscriptionId);
            await adminClient
                .from("feed_items")
                .delete()
                .eq("user_subscription_id", secondarySubscriptionId);
        });

        afterAll(async () => {
            await adminClient
                .from("feed_items")
                .delete()
                .eq("user_subscription_id", primarySubscriptionId);
            await adminClient
                .from("feed_items")
                .delete()
                .eq("user_subscription_id", secondarySubscriptionId);
            await adminClient
                .from("user_subscriptions")
                .delete()
                .in("id", [primarySubscriptionId, secondarySubscriptionId]);
            if (testUserId) {
                await adminClient.auth.admin.deleteUser(testUserId);
            }
            await anonClient.auth.signOut();
        });

        const createRequestScopedServices = () => {
            const req = {
                headers: { authorization: `Bearer ${accessToken}` },
                cookies: {},
            } as Request;
            const supabaseRequest = new SupabaseRequestService(req, config);
            return {
                supabaseRequest,
                repository: new FeedItemRepository(supabaseRequest),
                client: supabaseRequest.getClient(),
            };
        };

        const buildPayload = (
            overrides: Partial<FeedItemsInsertWithoutHash> = {},
        ): FeedItemInsertPayload => ({
            user_subscription_id:
                overrides.user_subscription_id ?? primarySubscriptionId,
            user_id: overrides.user_id ?? testUserId,
            title: overrides.title ?? `title-${randomUUID()}`,
            link:
                overrides.link ??
                `https://example.com/items/${randomUUID().slice(0, 8)}`,
            description: overrides.description ?? "E2E fixture",
            canonical_url:
                overrides.canonical_url === undefined
                    ? null
                    : overrides.canonical_url,
            published_at:
                overrides.published_at === undefined
                    ? PUBLISHED_AT
                    : overrides.published_at,
        });

        const insertFeedItemOrThrow = async (
            repository: FeedItemRepository,
            payload: FeedItemInsertPayload,
        ) => {
            const error = await repository.insertFeedItem(payload);
            if (error) throw error;
        };

        const fetchByTitle = async (
            client: SupabaseClient<Database>,
            title: string,
            subscriptionId = primarySubscriptionId,
        ): Promise<FeedItemRow> => {
            const { data, error } = await client
                .from("feed_items")
                .select("*")
                .eq("user_subscription_id", subscriptionId)
                .eq("title", title)
                .single();
            if (error || !data)
                throw error ?? new Error("feed_items取得に失敗");
            return data;
        };

        const countByLink = async (
            client: SupabaseClient<Database>,
            link: string,
            subscriptionId = primarySubscriptionId,
        ): Promise<number> => {
            const { data, error, count } = await client
                .from("feed_items")
                .select("id", { count: "exact" })
                .eq("user_subscription_id", subscriptionId)
                .eq("link", link);
            if (error) throw error;
            if (typeof count === "number") return count;
            return data?.length ?? 0;
        };

        it("Case A: canonical_url未指定でもトリガーでハッシュが付与される", async () => {
            const { repository, client } = createRequestScopedServices();
            const title = `case-a-${randomUUID()}`;
            const link = `https://example.com/basic/${randomUUID()}`;
            const payload = buildPayload({ title, link, canonical_url: null });

            await expect(
                insertFeedItemOrThrow(repository, payload),
            ).resolves.toBeUndefined();

            const row = await fetchByTitle(client, title);
            expect(row.user_id).toBe(testUserId);
            expect(isValidLinkHash(row.link_hash)).toBe(true);
            expect(row.link_hash).toBe(computeExpectedHash(null, link));
        });

        it("Case B: canonical_urlが優先され正規化結果でハッシュが固定される", async () => {
            const { repository, client } = createRequestScopedServices();
            const title = `case-b-${randomUUID()}`;
            const link = `https://example.com/case-b/${randomUUID()}`;
            const canonicalRaw = `  HTTPS://Example.com/Canonical-${randomUUID()}  `;
            const payload = buildPayload({
                title,
                link,
                canonical_url: canonicalRaw,
            });

            await expect(
                insertFeedItemOrThrow(repository, payload),
            ).resolves.toBeUndefined();

            const row = await fetchByTitle(client, title);
            expect(row.link_hash).toBe(computeExpectedHash(canonicalRaw, link));
        });

        it("Case C: 同一subscriptionで正規化後URLが一致すると23505で弾かれる", async () => {
            const { repository, client } = createRequestScopedServices();
            const title = `case-c-${randomUUID()}`;
            const link = `https://example.com/duplicate/${randomUUID()}`;
            const payload = buildPayload({ title, link });

            await insertFeedItemOrThrow(repository, payload);
            await expect(
                insertFeedItemOrThrow(repository, payload),
            ).rejects.toMatchObject({
                code: expect.stringContaining("23505"),
            });

            const rows = await client
                .from("feed_items")
                .select("id")
                .eq("user_subscription_id", primarySubscriptionId)
                .eq("title", title);
            expect(rows.data?.length ?? 0).toBe(1);
        });

        it("Case D: 並列挿入でも1件のみ成功し一意制約が動作する", async () => {
            const { repository, client } = createRequestScopedServices();
            const title = `case-d-${randomUUID()}`;
            const link = `https://example.com/concurrency/${randomUUID()}`;
            const payload = buildPayload({ title, link });

            const results = await Promise.allSettled([
                insertFeedItemOrThrow(repository, payload),
                insertFeedItemOrThrow(repository, payload),
            ]);

            const ok = results.filter((r) => r.status === "fulfilled");
            const ng = results.filter((r) => r.status === "rejected");

            expect(ok.length).toBe(1);
            expect(ng.length).toBe(1);
            const rejection = ng[0] as PromiseRejectedResult;
            const code = (rejection.reason?.code ??
                rejection.reason?.details?.code ??
                "") as string;
            expect(String(code)).toContain("23505");

            const count = await countByLink(client, link);
            expect(count).toBe(1);
        });

        it("Case E: UPDATEでlink_hashが再計算され重複時は23505", async () => {
            const { repository, client } = createRequestScopedServices();
            const title = `case-e-${randomUUID()}`;
            const link = `https://example.com/update/${randomUUID()}`;
            const payload = buildPayload({ title, link });

            await insertFeedItemOrThrow(repository, payload);
            const inserted = await fetchByTitle(client, title);
            const oldHash = inserted.link_hash;

            const newCanonical = `HTTPS://example.com/updated/${randomUUID()}`;
            const { data: updatedRows, error: updateError } = await client
                .from("feed_items")
                .update({ canonical_url: newCanonical })
                .eq("id", inserted.id)
                .eq("user_subscription_id", primarySubscriptionId)
                .select("*")
                .single();
            if (updateError || !updatedRows) {
                throw (
                    updateError ?? new Error("feed_itemsの更新に失敗しました")
                );
            }

            expect(updatedRows.link_hash).not.toBe(oldHash);
            expect(updatedRows.link_hash).toBe(
                computeExpectedHash(newCanonical, link),
            );

            const anotherTitle = `case-e-another-${randomUUID()}`;
            const anotherLink = `https://example.com/update/${randomUUID()}-other`;
            await insertFeedItemOrThrow(
                repository,
                buildPayload({ title: anotherTitle, link: anotherLink }),
            );
            const { error: conflictError } = await client
                .from("feed_items")
                .update({ canonical_url: newCanonical })
                .eq("title", anotherTitle)
                .eq("user_subscription_id", primarySubscriptionId);
            expect(conflictError?.code ?? "").toContain("23505");
        });

        it("Case F: サブスクリプションが異なれば同一URLでも衝突しない", async () => {
            const { repository, client } = createRequestScopedServices();
            const sharedLink = `https://example.com/cross/${randomUUID()}`;
            const titlePrimary = `case-f-primary-${randomUUID()}`;
            const titleSecondary = `case-f-secondary-${randomUUID()}`;

            await expect(
                insertFeedItemOrThrow(
                    repository,
                    buildPayload({ title: titlePrimary, link: sharedLink }),
                ),
            ).resolves.toBeUndefined();

            await expect(
                insertFeedItemOrThrow(
                    repository,
                    buildPayload({
                        title: titleSecondary,
                        link: sharedLink,
                        user_subscription_id: secondarySubscriptionId,
                    }),
                ),
            ).resolves.toBeUndefined();

            const primaryCount = await countByLink(client, sharedLink);
            expect(primaryCount).toBe(1);

            const secondaryRow = await fetchByTitle(
                client,
                titleSecondary,
                secondarySubscriptionId,
            );
            expect(secondaryRow.user_subscription_id).toBe(
                secondarySubscriptionId,
            );
        });

        it("Case G: linkのtrim/lower正規化が決定論的に適用される", async () => {
            const { repository, client } = createRequestScopedServices();
            const title = `case-g-${randomUUID()}`;
            const rawLink = "  HTTPS://Example.com/Path  ";

            await insertFeedItemOrThrow(
                repository,
                buildPayload({ title, link: rawLink, canonical_url: null }),
            );

            const row = await fetchByTitle(client, title);
            const expected = computeExpectedHash(null, rawLink);
            expect(row.link_hash).toBe(expected);
        });

        it("Case H: link_hashは常に64桁hexで返却される", async () => {
            const { repository, client } = createRequestScopedServices();
            const title = `case-h-${randomUUID()}`;
            const link = `https://example.com/hash/${randomUUID()}`;

            await insertFeedItemOrThrow(
                repository,
                buildPayload({ title, link, canonical_url: null }),
            );

            const row = await fetchByTitle(client, title);
            expect(row.link_hash).toMatch(/^[0-9a-f]{64}$/);
            expect(row.link_hash).toBe(computeExpectedHash(null, link));
        });
    });
});
