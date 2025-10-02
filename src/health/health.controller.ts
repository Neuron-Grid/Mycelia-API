// @file システムヘルスチェックAPIのコントローラ

import { TypedRoute } from "@nestia/core";
import { Controller, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type Redis from "ioredis";
import { AdminRoleGuard } from "@/auth/admin-role.guard";
import { RequiresMfaGuard } from "@/auth/requires-mfa.guard";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import type { SuccessResponse } from "@/common/utils/response.util";
import { buildResponse } from "@/common/utils/response.util";
import { RedisService } from "@/shared/redis/redis.service";
import { SupabaseRequestService } from "@/supabase-request.service";
import type { HealthCheckResponseDto } from "./dto/health-check-response.dto";

@Controller("health")
@UseGuards(SupabaseAuthGuard, RequiresMfaGuard, AdminRoleGuard, ThrottlerGuard)
// @public
// @since 1.0.0
export class HealthController {
    // @type {number}
    // @readonly
    // @private
    // @default 5000
    private readonly TIMEOUT_MS = 5000;

    // @param {SupabaseRequestService} supabaseRequestService - Supabaseリクエストサービス
    // @param {Queue} feedQueue - BullMQキュー
    // @param {RedisService} redisService - Redisサービス
    // @since 1.0.0
    // @public
    constructor(
        private readonly supabaseRequestService: SupabaseRequestService,
        private readonly redisService: RedisService,
    ) {}

    // @async
    // @public
    // @since 1.0.0
    // @returns {Promise<HealthCheckResponseDto>} - ヘルスチェック結果
    // @throws {HttpException} - チェック失敗時
    // @example
    // await healthController.checkHealth()
    // @see HealthCheckResponseDto
    @TypedRoute.Get("")
    /** Returns health check results */
    async checkHealth(): Promise<SuccessResponse<HealthCheckResponseDto>> {
        await this.checkDatabaseWithTimeout();
        await this.checkRedisWithTimeout();
        return buildResponse("Health checked", {
            status: "OK",
            db: "OK",
            redis: "OK",
        });
    }
    // @async
    // @private
    // @since 1.0.0
    // @returns {Promise<void>} - DBチェック結果
    // @throws {Error} - DBチェック失敗時
    // @example
    // await healthController['checkDatabaseWithTimeout']()
    // @see SupabaseRequestService.getClient
    private async checkDatabaseWithTimeout(): Promise<void> {
        const supabase = this.supabaseRequestService.getClient();

        await this.withTimeout(
            (async () => {
                const { error } = await supabase
                    .from("users")
                    .select("id")
                    .limit(1);
                if (error) {
                    throw new Error(`Database check failed: ${error.message}`);
                }
            })(),
            this.TIMEOUT_MS,
        );
    }

    // @async
    // @private
    // @since 1.0.0
    // @returns {Promise<void>} - Redisチェック結果
    // @throws {Error} - Redisチェック失敗時
    // @example
    // await healthController['checkRedisWithTimeout']()
    // @see RedisService.createMainClient
    private async checkRedisWithTimeout(): Promise<void> {
        await this.withTimeout(
            (async () => {
                const redisClient = this.redisService.getHealthClient();
                if (redisClient.status === "end") {
                    throw new Error(
                        "Redis health client has been closed unexpectedly",
                    );
                }

                if (this.shouldAwaitReady(redisClient.status)) {
                    await this.waitForReady(redisClient);
                }

                if (redisClient.status !== "ready") {
                    throw new Error(
                        `Redis health client not ready (status: ${redisClient.status})`,
                    );
                }

                const pong = await redisClient.ping();
                if (pong !== "PONG") {
                    throw new Error(
                        `Unexpected Redis ping response: ${pong ?? "<empty>"}`,
                    );
                }
            })(),
            this.TIMEOUT_MS,
        );
    }

    // @private
    // @since 1.0.0
    private shouldAwaitReady(status: Redis["status"]): boolean {
        return [
            "wait",
            "connecting",
            "connect",
            "reconnecting",
            "close",
        ].includes(status);
    }

    // @async
    // @private
    // @since 1.0.0
    private async waitForReady(client: Redis): Promise<void> {
        if (client.status === "ready") {
            return;
        }
        if (client.status === "end") {
            throw new Error("Redis connection ended before becoming ready");
        }

        await new Promise<void>((resolve, reject) => {
            const handleReady = () => {
                cleanup();
                resolve();
            };
            const handleError = (error: Error) => {
                cleanup();
                reject(error);
            };
            const handleEnd = () => {
                cleanup();
                reject(
                    new Error("Redis connection ended before becoming ready"),
                );
            };

            const cleanup = () => {
                client.removeListener("ready", handleReady);
                client.removeListener("error", handleError);
                client.removeListener("end", handleEnd);
            };

            client.once("ready", handleReady);
            client.once("error", handleError);
            client.once("end", handleEnd);

            if (client.status === "ready") {
                handleReady();
            }
        });
    }

    // @async
    // @private
    // @since 1.0.0
    // @template T
    // @param {Promise<T>} promise - タイムアウトをかけるPromise
    // @param {number} ms - タイムアウト時間（ミリ秒）
    // @returns {Promise<T>} - 結果
    // @throws {Error} - タイムアウト時
    // @example
    // await healthController['withTimeout'](Promise.resolve(1), 1000)
    private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error(`Timeout after ${ms}ms`)),
                ms,
            );

            promise
                .then((res) => {
                    clearTimeout(timer);
                    resolve(res);
                })
                .catch((err) => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }
}
