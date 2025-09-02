// NOTE: 開発中に Typia トランスフォームが未適用でも起動できるようにする暫定設定
// 本番運用では Typia 変換を有効にすることを推奨
import { NoTransformConfigurationError } from "@nestia/core/lib/decorators/NoTransformConfigurationError";

// 開発・テストのみで無効化（本番は型検証を維持）
if ((process.env.NODE_ENV || "development") !== "production") {
    // 例外スローを無効化（未設定の場合でも JSON.stringify にフォールバック）
    NoTransformConfigurationError.throws = false;
}
