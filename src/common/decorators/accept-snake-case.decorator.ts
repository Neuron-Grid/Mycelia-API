import { Transform, type TransformFnParams } from "class-transformer";

const toSnakeCase = (key: string): string =>
    key
        .replace(/([A-Z])/g, "_$1")
        .replace(/[-\s]+/g, "_")
        .toLowerCase()
        .replace(/^_+/, "");

export const AcceptSnakeCase = (...aliases: string[]): PropertyDecorator =>
    Transform(({ value, obj, key }: TransformFnParams) => {
        if (value !== undefined) {
            return value;
        }
        if (!obj || typeof obj !== "object") {
            return value;
        }

        const candidates = [...aliases];
        if (typeof key === "string") {
            candidates.push(toSnakeCase(key));
        }

        for (const candidate of candidates) {
            if (!candidate) {
                continue;
            }
            if (Object.hasOwn(obj, candidate)) {
                const candidateValue = (obj as Record<string, unknown>)[
                    candidate
                ];
                if (candidateValue !== undefined) {
                    return candidateValue;
                }
            }
        }

        return value;
    });
