import { ConfigService } from "@nestjs/config";

import { CloudflareR2Service } from "@/podcast/cloudflare-r2.service";

const createService = (overrides?: Record<string, string | undefined>) => {
    const defaults: Record<string, string | undefined> = {
        CLOUDFLARE_ACCOUNT_ID: "test-account",
        CLOUDFLARE_ACCESS_KEY_ID: "test-access-key",
        CLOUDFLARE_SECRET_ACCESS_KEY: "test-secret",
        CLOUDFLARE_BUCKET_NAME: "primary-bucket",
        CLOUDFLARE_PUBLIC_DOMAIN: "media.example.com",
    };
    const configValues = new Map<string, string | undefined>(
        Object.entries({ ...defaults, ...overrides }),
    );

    const configService = {
        get<T = string>(key: string): T | undefined {
            return configValues.get(key) as T | undefined;
        },
    } satisfies ConfigService;

    return new CloudflareR2Service(configService);
};

describe("CloudflareR2Service.extractObjectLocationFromUrl", () => {
    it("should parse bucket and key from path-style signed URLs", () => {
        const service = createService();
        const { bucket, key } = service.extractObjectLocationFromUrl(
            "https://test-account.r2.cloudflarestorage.com/primary-bucket/podcasts/user-1/episode-1.ogg",
        );

        expect(bucket).toBe("primary-bucket");
        expect(key).toBe("podcasts/user-1/episode-1.ogg");
    });

    it("should parse bucket and key from virtual-hosted style URLs", () => {
        const service = createService();
        const { bucket, key } = service.extractObjectLocationFromUrl(
            "https://primary-bucket.test-account.r2.cloudflarestorage.com/podcasts/user-1/episode-2.ogg",
        );

        expect(bucket).toBe("primary-bucket");
        expect(key).toBe("podcasts/user-1/episode-2.ogg");
    });

    it("should resolve bucket from public domain URLs", () => {
        const service = createService();
        const { bucket, key } = service.extractObjectLocationFromUrl(
            "https://media.example.com/podcasts/user-1/episode-3.ogg",
        );

        expect(bucket).toBe("primary-bucket");
        expect(key).toBe("podcasts/user-1/episode-3.ogg");
    });
});
