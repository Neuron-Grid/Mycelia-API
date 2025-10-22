import { Injectable, Logger } from "@nestjs/common";

export type AuthGuardMetricOutcome =
    | "success"
    | "token_expired"
    | "invalid_token"
    | "deleted"
    | "error";

export type AuthGuardMetricPayload = {
    readonly outcome: AuthGuardMetricOutcome;
    readonly durationMs: number;
    readonly userId?: string;
};

@Injectable()
export class SupabaseAuthMetricsService {
    private readonly logger = new Logger(SupabaseAuthMetricsService.name);

    record(payload: AuthGuardMetricPayload): void {
        // 現段階ではログ出力のみ。APM 連携はここにフックする
        const { outcome, durationMs, userId } = payload;
        const suffix = userId ? ` user=${userId}` : "";
        this.logger.debug(
            `Supabase auth guard outcome=${outcome} duration=${durationMs.toFixed(2)}ms${suffix}`,
        );
        // 将来的にPrometheusや外部APMへ連携する場合はここで実装
    }
}
