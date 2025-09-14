import type { LookupAddress } from "node:dns";
import { promises as dns } from "node:dns";
import type { ConfigService } from "@nestjs/config";
import ipaddr from "ipaddr.js";

export type Cidr = [ipaddr.IPv4 | ipaddr.IPv6, number];

export function parseCidr(input: string): Cidr | null {
    try {
        const [addr, range] = ipaddr.parseCIDR(input.trim());
        return [addr, range];
    } catch {
        return null;
    }
}

export function parseExtraDenyCidrsFromEnv(cfg: ConfigService): Cidr[] {
    const raw = cfg.get<string>("FEED_FETCH_EXTRA_DENY_CIDRS", "");
    if (!raw) return [];
    const tokens = raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    const cidrs: Cidr[] = [];
    for (const t of tokens) {
        const c = parseCidr(t);
        if (c) cidrs.push(c);
    }
    return cidrs;
}

export function isIpInCidrs(ip: string, cidrs: Cidr[]): boolean {
    let parsed: ipaddr.IPv4 | ipaddr.IPv6;
    try {
        parsed = ipaddr.parse(ip);
    } catch {
        return true; // パース不能＝安全側で拒否
    }
    return cidrs.some((c) => parsed.match(c));
}

export function isBlockedIp(ip: string, extraCidrs: Cidr[]): boolean {
    try {
        const addr = ipaddr.parse(ip);
        const r = addr.range();
        // unicast 以外は全拒否
        if (r !== "unicast") return true;
        // 追加deny CIDR
        if (isIpInCidrs(ip, extraCidrs)) return true;
        return false;
    } catch {
        return true;
    }
}

export async function resolveHostAll(
    hostname: string,
): Promise<LookupAddress[]> {
    // A/AAAA を verbatim で解決（OS順序に依存しない）
    const list = await dns.lookup(hostname, { all: true, verbatim: true });
    return list;
}

export async function resolveAndFilterUnicast(
    hostname: string,
    extraCidrs: Cidr[],
): Promise<{ safeIps: string[]; allIps: string[] }> {
    const addrs = await resolveHostAll(hostname);
    const allIps = addrs.map((a) => a.address);
    const safeIps = allIps.filter((ip) => !isBlockedIp(ip, extraCidrs));
    return { safeIps, allIps };
}
