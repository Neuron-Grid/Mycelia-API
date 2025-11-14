import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let hasLoadedEnv = false;

interface LoadOptions {
    readonly path?: string;
    readonly encoding?: BufferEncoding;
}

export function ensureEnvLoaded(options?: LoadOptions): void {
    if (hasLoadedEnv) return;

    const envFilePath = resolveEnvFilePath(options?.path);
    try {
        const raw = readFileSync(envFilePath, {
            encoding: options?.encoding ?? "utf8",
        });
        applyEnv(parseEnv(raw));
    } catch (error) {
        if (!isEnoent(error)) {
            throw error;
        }
        // `.env` が存在しない場合は無視（既存の process.env をそのまま利用）
    }

    hasLoadedEnv = true;
}

function resolveEnvFilePath(explicit?: string): string {
    if (explicit && explicit.trim().length > 0) {
        return resolve(process.cwd(), explicit.trim());
    }
    const override = process.env.APP_ENV_FILE;
    if (override && override.trim().length > 0) {
        return resolve(process.cwd(), override.trim());
    }
    return resolve(process.cwd(), ".env");
}

function isEnoent(error: unknown): error is NodeJS.ErrnoException {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
    );
}

function parseEnv(contents: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const assignment = trimmed.startsWith("export ")
            ? trimmed.slice("export ".length)
            : trimmed;
        const equalsIndex = assignment.indexOf("=");
        if (equalsIndex === -1) continue;
        const key = assignment.slice(0, equalsIndex).trim();
        if (!key) continue;

        const value = assignment.slice(equalsIndex + 1);
        result[key] = stripWrappingQuotes(value.trim());
    }
    return result;
}

function stripWrappingQuotes(value: string): string {
    if (value.length >= 2) {
        const first = value[0];
        const last = value[value.length - 1];
        if (
            (first === '"' && last === '"') ||
            (first === "'" && last === "'")
        ) {
            return value.slice(1, -1);
        }
    }
    return value;
}

function applyEnv(entries: Record<string, string>): void {
    for (const [key, value] of Object.entries(entries)) {
        if (process.env[key] !== undefined) continue;
        process.env[key] = value;
    }
}
