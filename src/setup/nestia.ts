// NOTE: 開発中に Typia トランスフォームが未適用でも起動できるようにする暫定設定
// 本番運用では Typia 変換を有効にすることを推奨
import { NoTransformConfigurationError } from "@nestia/core/lib/decorators/NoTransformConfigurationError";
import { resolveNodeEnvironment } from "@/config/app-env";

// 開発・テストのみで無効化（本番は型検証を維持）
const nodeEnv = resolveNodeEnvironment(process.env);
if (nodeEnv !== "production") {
    // 例外スローを無効化（未設定の場合でも JSON.stringify にフォールバック）
    NoTransformConfigurationError.throws = false;
}
