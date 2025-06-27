import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";

// 汎用DTOバリデーションユーティリティ
// クラスとプレーンオブジェクトを受け取り、
// バリデーションに成功したインスタンスを返す。
// 失敗した場合は例外を投げる。
export async function validateDto<T extends object>(
    cls: new () => T,
    obj: unknown,
): Promise<T> {
    const instance = plainToInstance(cls, obj);
    await validateOrReject(instance as object);
    return instance as T;
}
