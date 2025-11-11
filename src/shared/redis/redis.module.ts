import { existsSync, readFileSync } from "node:fs";
import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import type { ClusterNode, ClusterOptions, RedisOptions } from "ioredis";
import { RedisService } from "./redis.service";

type RedisConnectionConfig =
    | {
          mode: "single";
          options: RedisOptions;
      }
    | {
          mode: "cluster";
          nodes: ClusterNode[];
          options: ClusterOptions;
      };

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
        const buf = Buffer.from(trimmed, "base64");
        if (
            buf.toString("base64").replace(/=+$/, "") ===
            trimmed.replace(/=+$/, "")
        ) {
            return buf;
        }
    } catch {
        // fall through to utf8
    }

    return Buffer.from(trimmed, "utf8");
}

function buildTlsOptions(
    config: ConfigService,
    servername?: string,
    force = false,
): RedisOptions["tls"] {
    const ca = maybeDecodePem(config.get<string>("REDIS_TLS_CA"));
    const cert = maybeDecodePem(config.get<string>("REDIS_TLS_CERT"));
    const key = maybeDecodePem(config.get<string>("REDIS_TLS_KEY"));

    if (!ca && !cert && !key && !force) {
        return undefined;
    }

    const rejectUnauthorizedRaw = config.get<string>(
        "REDIS_TLS_REJECT_UNAUTHORIZED",
    );
    const rejectUnauthorized =
        rejectUnauthorizedRaw === undefined
            ? true
            : rejectUnauthorizedRaw !== "false";

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
        .filter(Boolean)
        .map((endpoint) => {
            const [host, portString] = endpoint.split(":");
            const port = Number(portString) || 6379;
            if (!host) {
                throw new Error(
                    `Invalid REDIS_CLUSTER_ENDPOINTS entry "${endpoint}"`,
                );
            }
            return { host, port };
        });
}

function getNodeHost(node?: ClusterNode): string | undefined {
    if (!node) return undefined;
    if (typeof node === "string") {
        return node.split(":")[0];
    }
    if (Array.isArray(node)) {
        const hostCandidate = node[0];
        return typeof hostCandidate === "string" ? hostCandidate : undefined;
    }
    if (typeof node === "object" && node !== null) {
        return (node as { host?: string }).host ?? undefined;
    }
    return undefined;
}

// どのModuleからも使えるようにGlobalにする
@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: "REDIS_CONNECTION_OPTIONS",
            useFactory: (config: ConfigService): RedisConnectionConfig => {
                const clusterRaw = config
                    .get<string>("REDIS_CLUSTER_ENDPOINTS")
                    ?.trim();
                const username =
                    config.get<string>("REDIS_USERNAME")?.trim() || undefined;
                const password =
                    config.get<string>("REDIS_PASSWORD")?.trim() || undefined;

                if (clusterRaw) {
                    const nodes = parseClusterEndpoints(
                        clusterRaw,
                    ) as ClusterNode[];
                    if (nodes.length === 0)
                        throw new Error(
                            "REDIS_CLUSTER_ENDPOINTS must list at least one endpoint",
                        );

                    const firstNode = nodes[0];
                    const servername = getNodeHost(firstNode);
                    const tls = buildTlsOptions(config, servername);

                    const redisOptions: RedisOptions = {
                        username,
                        password,
                        tls,
                        maxRetriesPerRequest: null,
                        enableReadyCheck: false,
                    };

                    return {
                        mode: "cluster",
                        nodes,
                        options: {
                            redisOptions,
                        },
                    };
                }

                const url = config.get<string>("REDIS_URL");
                if (!url)
                    throw new Error(
                        "Either REDIS_URL or REDIS_CLUSTER_ENDPOINTS must be set",
                    );

                const u = new URL(url);
                const host = u.hostname;
                const port = Number(u.port) || 6379;
                const db =
                    u.pathname && u.pathname.length > 1
                        ? Number(u.pathname.slice(1))
                        : 0;

                const tls =
                    u.protocol === "rediss:"
                        ? buildTlsOptions(config, host, true)
                        : buildTlsOptions(config, host);

                const singleOptions: RedisOptions = {
                    host,
                    port,
                    username: username ?? (u.username || undefined),
                    password: password ?? (u.password || undefined),
                    db,
                    tls,
                    maxRetriesPerRequest: null,
                    enableReadyCheck: false,
                };

                return {
                    mode: "single",
                    options: singleOptions,
                };
            },
            inject: [ConfigService],
        },
        RedisService,
    ],
    exports: ["REDIS_CONNECTION_OPTIONS", RedisService],
})
export class RedisModule {}
