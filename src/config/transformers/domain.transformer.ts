import type { DomainConfig } from "@/config/app-env";

export function buildDomainConfig(env: NodeJS.ProcessEnv): DomainConfig {
    const frontOrigin = env.FRONT_ORIGIN?.trim();
    const productionDomain = env.PRODUCTION_DOMAIN?.trim();
    return {
        frontOrigin:
            frontOrigin && frontOrigin.length > 0 ? frontOrigin : undefined,
        productionDomain:
            productionDomain && productionDomain.length > 0
                ? productionDomain
                : undefined,
    };
}
