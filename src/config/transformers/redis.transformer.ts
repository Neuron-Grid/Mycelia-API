import { existsSync, readFileSync } from "node:fs";
import type { ClusterNode, ClusterOptions, RedisOptions } from "ioredis";
import type { RedisConnectionConfig } from "@/config/app-env";

function maybeDecodePem(value?: string): Buffer | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    if (existsSync(trimmed)) {
        return readFileSync(trimmed);
    }

    if (trimmed.startsWith("-----BEGIN ")) {
        return Buffer.from(trimmed);
    }

    try {
        const decoded = Buffer.from(trimmed, "base64");
        if (
            decoded.toString("base64").replace(/=+$/, "") ===
            trimmed.replace(/=+$/, "")
        ) {
            return decoded;
        }
    } catch {
        // fall through to utf8
    }

    return Buffer.from(trimmed, "utf8");
}

function buildTlsOptions(
    env: NodeJS.ProcessEnv,
    servername?: string,
    force = false,
): RedisOptions["tls"] {
    const ca = maybeDecodePem(env.REDIS_TLS_CA);
    const cert = maybeDecodePem(env.REDIS_TLS_CERT);
    const key = maybeDecodePem(env.REDIS_TLS_KEY);

    if (!ca && !cert && !key && !force) {
        return undefined;
    }

    const rejectUnauthorizedRaw = env.REDIS_TLS_REJECT_UNAUTHORIZED;
    const rejectUnauthorized =
        rejectUnauthorizedRaw === undefined
            ? true
            : rejectUnauthorizedRaw.trim().toLowerCase() !== "false";

    return {
        ca: ca ? [ca] : undefined,
        cert,
        key,
        servername,
        rejectUnauthorized,
    };
}

function parseClusterEndpoints(raw: string): ClusterNode[] {
    return raw
        .split(/[\s,]+/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((endpoint) => {
            const [host, portString] = endpoint.split(":");
            const port = Number(portString) || 6379;
            if (!host) {
                throw new Error(
                    `Invalid REDIS_CLUSTER_ENDPOINTS entry "${endpoint}"`,
                );
            }
            return { host, port } satisfies ClusterNode;
        });
}

function getNodeHost(node?: ClusterNode): string | undefined {
    if (!node) return undefined;
    if (typeof node === "string") {
        return node.split(":")[0];
    }
    if (Array.isArray(node)) {
        const candidate = node[0];
        return typeof candidate === "string"
            ? candidate.split(":")[0]
            : undefined;
    }
    if (typeof node === "object") {
        return (node as { host?: string }).host ?? undefined;
    }
    return undefined;
}

function sanitizeUsername(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function sanitizePassword(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function buildRedisConfig(
    env: NodeJS.ProcessEnv,
): RedisConnectionConfig {
    const username = sanitizeUsername(env.REDIS_USERNAME);
    const password = sanitizePassword(env.REDIS_PASSWORD);
    const clusterRaw = env.REDIS_CLUSTER_ENDPOINTS?.trim();

    if (clusterRaw) {
        const nodes = parseClusterEndpoints(clusterRaw);
        if (nodes.length === 0) {
            throw new Error(
                "REDIS_CLUSTER_ENDPOINTS must list at least one endpoint",
            );
        }

        const firstNode = nodes[0];
        const servername = getNodeHost(firstNode);
        const tls = buildTlsOptions(env, servername);

        const redisOptions: RedisOptions = {
            username,
            password,
            tls,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        };

        const clusterOptions: ClusterOptions = {
            redisOptions,
        };

        return {
            mode: "cluster",
            nodes,
            options: clusterOptions,
        };
    }

    const urlRaw = env.REDIS_URL;
    if (!urlRaw) {
        throw new Error(
            "Either REDIS_URL or REDIS_CLUSTER_ENDPOINTS must be set",
        );
    }

    const url = new URL(urlRaw);
    const host = url.hostname;
    const port = Number(url.port) || 6379;
    const db =
        url.pathname && url.pathname.length > 1
            ? Number(url.pathname.slice(1)) || 0
            : 0;

    const tls =
        url.protocol === "rediss:"
            ? buildTlsOptions(env, host, true)
            : buildTlsOptions(env, host);

    const singleOptions: RedisOptions = {
        host,
        port,
        username: username ?? (url.username || undefined),
        password: password ?? (url.password || undefined),
        db,
        tls,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    };

    return {
        mode: "single",
        options: singleOptions,
    };
}
