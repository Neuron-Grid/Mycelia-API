const REQUIRED_STRING_KEYS: readonly string[] = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_ACCESS_KEY_ID",
    "CLOUDFLARE_SECRET_ACCESS_KEY",
    "CLOUDFLARE_BUCKET_NAME",
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
];

const AT_LEAST_ONE_KEY_SETS: readonly string[][] = [
    ["REDIS_URL", "REDIS_CLUSTER_ENDPOINTS"],
];

type NumericKeyConstraint = {
    readonly key: string;
    readonly minimum?: number;
    readonly maximum?: number;
};

const NUMERIC_KEYS: readonly NumericKeyConstraint[] = [
    {
        key: "FEED_FETCH_CONNECT_TIMEOUT_MS",
        minimum: 100,
    },
    {
        key: "FEED_FETCH_RESPONSE_TIMEOUT_MS",
        minimum: 100,
    },
    {
        key: "FEED_FETCH_MAX_REDIRECTS",
        minimum: 0,
        maximum: 10,
    },
    {
        key: "FEED_FETCH_BODY_IDLE_TIMEOUT_MS",
        minimum: 100,
    },
    {
        key: "FEED_FETCH_TOTAL_TIMEOUT_MS",
        minimum: 100,
    },
    {
        key: "FEED_FETCH_MAX_BYTES",
        minimum: 1024,
    },
    {
        key: "SUPABASE_AUTH_CACHE_TTL_MS",
        minimum: 1000,
    },
    {
        key: "PORT",
        minimum: 1,
        maximum: 65535,
    },
    {
        key: "TRUST_PROXY_HOPS",
        minimum: 0,
    },
];

function ensureRequiredStrings(env: Record<string, unknown>): void {
    const missing: string[] = [];
    for (const key of REQUIRED_STRING_KEYS) {
        const value = env[key];
        if (typeof value !== "string" || value.trim().length === 0) {
            missing.push(key);
        }
    }

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}`,
        );
    }
}

function ensureAtLeastOne(env: Record<string, unknown>): void {
    const missingGroups = AT_LEAST_ONE_KEY_SETS.filter(
        (group) =>
            !group.some((key) => {
                const value = env[key];
                return typeof value === "string" && value.trim().length > 0;
            }),
    );

    if (missingGroups.length > 0) {
        const formatted = missingGroups
            .map((group) => `[${group.join(" | ")}]`)
            .join(", ");
        throw new Error(
            `Missing required environment variables: provide at least one value for each of ${formatted}`,
        );
    }
}

function ensureNumericIfPresent(env: Record<string, unknown>): void {
    for (const constraint of NUMERIC_KEYS) {
        const rawValue = env[constraint.key];
        if (rawValue === undefined || rawValue === null) continue;
        if (typeof rawValue === "number") {
            validateNumber(constraint, rawValue);
            continue;
        }
        if (typeof rawValue !== "string") {
            throw new Error(
                `Environment variable ${constraint.key} must be a number or numeric string`,
            );
        }
        if (rawValue.trim().length === 0) {
            throw new Error(
                `Environment variable ${constraint.key} must not be empty`,
            );
        }
        const parsed = Number(rawValue);
        if (Number.isNaN(parsed)) {
            throw new Error(
                `Environment variable ${constraint.key} must be numeric`,
            );
        }
        validateNumber(constraint, parsed);
    }
}

function validateNumber(constraint: NumericKeyConstraint, value: number): void {
    if (constraint.minimum !== undefined && value < constraint.minimum) {
        throw new Error(
            `Environment variable ${constraint.key} must be >= ${constraint.minimum}`,
        );
    }
    if (constraint.maximum !== undefined && value > constraint.maximum) {
        throw new Error(
            `Environment variable ${constraint.key} must be <= ${constraint.maximum}`,
        );
    }
}

export function validateEnv(
    env: Record<string, unknown>,
): Record<string, unknown> {
    ensureRequiredStrings(env);
    ensureAtLeastOne(env);
    ensureNumericIfPresent(env);
    return env;
}
