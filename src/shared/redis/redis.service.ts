import { Inject, Injectable } from "@nestjs/common";
import Redis, {
    Cluster,
    ClusterNode,
    ClusterOptions,
    RedisOptions,
} from "ioredis";

type SingleConfig = {
    mode: "single";
    options: RedisOptions;
};

type ClusterConfig = {
    mode: "cluster";
    nodes: ClusterNode[];
    options: ClusterOptions;
};

type RedisConnectionOptions = SingleConfig | ClusterConfig;

@Injectable()
export class RedisService {
    constructor(
        @Inject("REDIS_CONNECTION_OPTIONS")
        private readonly opts: RedisConnectionOptions,
    ) {}

    private buildSingleOptions(
        overrides?: Partial<RedisOptions>,
    ): RedisOptions {
        if (this.opts.mode === "single") {
            return {
                ...this.opts.options,
                ...overrides,
            };
        }
        const base =
            this.opts.options.redisOptions ??
            ({
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
            } satisfies RedisOptions);
        return {
            ...base,
            ...overrides,
        };
    }

    // 各サービスが利用するRedisクライアントを生成
    createMainClient(): Redis | Cluster {
        if (this.opts.mode === "cluster") {
            return new Redis.Cluster(this.opts.nodes, {
                ...this.opts.options,
                redisOptions: this.buildSingleOptions(
                    this.opts.options.redisOptions,
                ),
            });
        }
        return new Redis(this.buildSingleOptions());
    }

    // Bull用クライアント
    // type毎に細かな違いを吸収
    createBullClient(
        type: "client" | "subscriber" | "bclient" = "client",
    ): Redis | Cluster {
        if (this.opts.mode === "cluster") {
            return new Redis.Cluster(this.opts.nodes, {
                ...this.opts.options,
                redisOptions: this.buildSingleOptions({
                    connectionName: type,
                }),
            });
        }
        return new Redis(
            this.buildSingleOptions({
                connectionName: type,
            }),
        );
    }
}
