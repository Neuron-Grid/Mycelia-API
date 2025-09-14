import { describe, expect, it } from "@jest/globals";
import {
    type Cidr,
    isBlockedIp,
    isIpInCidrs,
    parseCidr,
} from "@/common/net/ip-range.util";

describe("ip-range.util", () => {
    it("parseCidr parses valid CIDR and rejects invalid", () => {
        const ok = parseCidr("10.0.0.0/8");
        expect(ok).not.toBeNull();
        const ng = parseCidr("bad");
        expect(ng).toBeNull();
    });

    it("isBlockedIp blocks non-unicast ranges", () => {
        // loopback
        expect(isBlockedIp("127.0.0.1", [])).toBe(true);
        // private
        expect(isBlockedIp("10.1.2.3", [])).toBe(true);
        // link local
        expect(isBlockedIp("169.254.1.1", [])).toBe(true);
        // unspecified
        expect(isBlockedIp("0.0.0.0", [])).toBe(true);
        // global unicast
        expect(isBlockedIp("93.184.216.34", [])).toBe(false);
    });

    it("isIpInCidrs respects extra deny list", () => {
        const c1 = parseCidr("100.64.0.0/10");
        const c2 = parseCidr("198.18.0.0/15");
        expect(c1).not.toBeNull();
        expect(c2).not.toBeNull();
        const list: Cidr[] = [c1 as Cidr, c2 as Cidr];
        expect(isIpInCidrs("100.64.1.1", list)).toBe(true);
        expect(isIpInCidrs("93.184.216.34", list)).toBe(false);
    });
});
