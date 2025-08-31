import { Injectable } from "@nestjs/common";
import type { RedisService } from "@/shared/redis/redis.service";
import type { AuthRepositoryPort } from "./domain/auth.repository";

/**
 * WebAuthn(パスキー) MFA のドメインサービス
 *
 * Supabase Auth RPC ラッパー (AuthRepository) と Redis を橋渡しし、
 * ブラウザ ↔ Supabase 間で使用する challenge を一時保存して検証を補助する。
 *
 * 現状は Supabase 側で challengeId を内部に保持しているため
 * 追加の DB 永続化は行わず、TTL 付きキャッシュとしてのみ保持する。
 * 将来的に device binding / 複数ステップなどが必要になれば
 * challenge → factorId のマッピング保存に拡張する。
 */
@Injectable()
export class WebAuthnService {
    /** challenge の有効期限 (秒) */
    private static readonly CHALLENGE_TTL_SEC = 300;

    constructor(
        private readonly authRepo: AuthRepositoryPort,
        private readonly redisService: RedisService,
    ) {}

    /**
     * WebAuthn 登録開始 (navigator.credentials.create 前段)
     * @param displayName - デバイスを識別する任意表示名
     */
    async startRegistration(displayName?: string) {
        const data = await this.authRepo.startWebAuthnRegistration(displayName);

        // Supabase 返却値内の challenge を抽出して TTL キャッシュに保存
        // 失敗しても致命的ではないため await は無し
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.cacheChallenge((data as Record<string, unknown>).publicKey);

        return data;
    }

    /**
     * WebAuthn 登録完了 (attestationResponse 検証)
     * @param attestationResponse - navigator.credentials.create() の戻り値
     */
    async finishRegistration(attestationResponse: Record<string, unknown>) {
        await this.removeCachedChallenge(attestationResponse);
        return await this.authRepo.finishWebAuthnRegistration(
            attestationResponse,
        );
    }

    /**
     * WebAuthn 認証 (assertionResponse 検証)
     * @param assertionResponse - navigator.credentials.get() の戻り値
     */
    async verifyAssertion(assertionResponse: Record<string, unknown>) {
        return await this.authRepo.verifyWebAuthnAssertion(assertionResponse);
    }

    /* ------------------------------------------------------------------ */
    /*                               Helpers                              */
    /* ------------------------------------------------------------------ */

    /** publicKey.challenge を redis に TTL 付きで保存 */
    private async cacheChallenge(publicKey?: unknown) {
        try {
            if (
                typeof publicKey === "object" &&
                publicKey !== null &&
                "challenge" in publicKey
            ) {
                const challenge = (publicKey as { challenge?: string })
                    .challenge;
                if (typeof challenge === "string" && challenge.length) {
                    const client = this.redisService.createMainClient();
                    await client.setex(
                        `webauthn:challenge:${challenge}`,
                        WebAuthnService.CHALLENGE_TTL_SEC,
                        "1",
                    );
                }
            }
        } catch {
            /* ignore cache errors */
        }
    }

    /** attestationResponse 内の challenge を削除 */
    private async removeCachedChallenge(resp: Record<string, unknown>) {
        try {
            const challenge = (
                resp?.response as Record<string, unknown> | undefined
            )?.clientDataJSON;
            if (typeof challenge === "string") {
                const client = this.redisService.createMainClient();
                await client.del(`webauthn:challenge:${challenge}`);
            }
        } catch {
            /* ignore cache errors */
        }
    }
}
