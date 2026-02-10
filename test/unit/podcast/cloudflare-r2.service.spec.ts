import type { AppEnv, CloudflareR2Config } from "@/config/app-env";
import { CloudflareR2Service } from "@/podcast/cloudflare-r2.service";

const createService = (overrides?: Partial<CloudflareR2Config>) => {
    const config: CloudflareR2Config = {
        accountId: "test-account",
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret",
        bucketName: "primary-bucket",
        publicDomain: "media.example.com",
        allowedBuckets: ["primary-bucket"],
        allowedPrefixTemplates: ["podcasts/{userId}/"],
        ...overrides,
    };
    const appEnv = {
        getCloudflareR2Config: () => config,
    } as unknown as AppEnv;

    return new CloudflareR2Service(appEnv);
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

    it("should retain empty segments in keys", () => {
        const service = createService();
        const { bucket, key } = service.extractObjectLocationFromUrl(
            "https://media.example.com/folder//file.ogg",
        );

        expect(bucket).toBe("primary-bucket");
        expect(key).toBe("folder//file.ogg");
    });

    it("should keep trailing slash for directory-style keys", () => {
        const service = createService();
        const { key } = service.extractObjectLocationFromUrl(
            "https://media.example.com/folder/",
        );

        expect(key).toBe("folder/");
    });

    it("should parse path-style URLs with bucket segment", () => {
        const service = createService();
        const { bucket, key } = service.extractObjectLocationFromUrl(
            "https://test-account.r2.cloudflarestorage.com/bucket/folder//file.ogg",
        );

        expect(bucket).toBe("bucket");
        expect(key).toBe("folder//file.ogg");
    });

    it("should return empty key when bucket path has no object", () => {
        const service = createService();
        const { bucket, key } = service.extractObjectLocationFromUrl(
            "https://test-account.r2.cloudflarestorage.com/bucket/",
        );

        expect(bucket).toBe("bucket");
        expect(key).toBe("");
    });
});
