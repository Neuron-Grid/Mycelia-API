import { jest } from "@jest/globals";
import type { SupabaseRequestService } from "@/supabase-request.service";

export type SupabaseTableChain = {
    select: jest.Mock;
    eq: jest.Mock;
    or: jest.Mock;
    order: jest.Mock;
    range: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    in: jest.Mock;
    single: jest.Mock;
};

export const createSupabaseTableChain = (): SupabaseTableChain => {
    const chain: SupabaseTableChain = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        or: jest.fn(() => chain),
        order: jest.fn(() => chain),
        range: jest.fn(() => chain),
        insert: jest.fn(() => chain),
        update: jest.fn(() => chain),
        in: jest.fn(() => chain),
        single: jest.fn(),
    };
    return chain;
};

export type SupabaseMock = {
    supabaseService: SupabaseRequestService;
    getClientMock: jest.Mock;
    fromMock: jest.Mock;
    tableChains: Map<string, SupabaseTableChain>;
};

export function createSupabaseServiceMock(): SupabaseMock {
    const tableChains = new Map<string, SupabaseTableChain>();
    const fromMock = jest.fn((table: string) => {
        let chain = tableChains.get(table);
        if (!chain) {
            chain = createSupabaseTableChain();
            tableChains.set(table, chain);
        }
        return chain;
    });

    const client = { from: fromMock };
    const getClientMock = jest.fn(() => client);

    const supabaseService = {
        getClient: getClientMock,
    } as unknown as SupabaseRequestService;

    return { supabaseService, getClientMock, fromMock, tableChains };
}
