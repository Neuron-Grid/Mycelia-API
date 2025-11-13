import type { CloudflareR2Config } from "@/config/app-env";

function parseList(raw?: string | null): string[] {
    if (!raw) return [];
    return raw
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

export function buildCloudflareR2Config(
    env: NodeJS.ProcessEnv,
): CloudflareR2Config {
    const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
    const accessKeyId = env.CLOUDFLARE_ACCESS_KEY_ID?.trim() ?? "";
    const secretAccessKey = env.CLOUDFLARE_SECRET_ACCESS_KEY?.trim() ?? "";
    const bucketName = env.CLOUDFLARE_BUCKET_NAME?.trim() ?? "";
    const publicDomain = env.CLOUDFLARE_PUBLIC_DOMAIN?.trim() ?? "";
    const allowedBucketsRaw = env.CLOUDFLARE_ALLOWED_BUCKETS;
    const allowedPrefixesRaw = env.CLOUDFLARE_ALLOWED_PREFIXES;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
        throw new Error(
            "Cloudflare R2 environment variables are not fully configured",
        );
    }

    const allowedBuckets = parseList(allowedBucketsRaw);
    if (allowedBuckets.length === 0) {
        allowedBuckets.push(bucketName);
    }

    const allowedPrefixTemplates = parseList(allowedPrefixesRaw);
    if (allowedPrefixTemplates.length === 0) {
        allowedPrefixTemplates.push(
            "podcasts/{userId}/",
            "summaries/{userId}/",
        );
    }

    return {
        accountId,
        accessKeyId,
        secretAccessKey,
        bucketName,
        publicDomain,
        allowedBuckets,
        allowedPrefixTemplates,
    };
}
