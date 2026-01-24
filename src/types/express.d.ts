import "express";
import type { JwtAuthClaims } from "@/types/auth-claims";
import type { User as SupabaseUser } from "@supabase/supabase-js";

declare module "express-serve-static-core" {
    interface Request {
        /** Supabase JWT のデコード済みクレーム */
        authClaims?: JwtAuthClaims;
        /** Request correlation id */
        requestId?: string;
        /** Supabase auth user */
        user?: SupabaseUser;
    }
}
