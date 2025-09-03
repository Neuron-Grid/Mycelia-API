import typia, { tags } from "typia";

/**
 * TypedParam用: 10進整数（uint32）に厳格変換
 * - 数値以外/NaN/範囲外は typia の TypeGuardError を投げる
 */
export const parseUInt32 = (value: string) =>
    typia.assert<number & tags.Type<"uint32">>(Number.parseInt(value, 10));

/**
 * TypedParam用: 10進整数（int32）に厳格変換
 */
export const parseInt32 = (value: string) =>
    typia.assert<number & tags.Type<"int32">>(Number.parseInt(value, 10));

/**
 * TypedParam用: boolean 変換（"true"/"false"/"1"/"0"）
 */
export const parseBoolean = (value: string) => {
    if (value === "true" || value === "1") return true as const;
    if (value === "false" || value === "0") return false as const;
    // 型意図に合わせて厳格に弾く
    throw new Error("Invalid boolean string");
};
