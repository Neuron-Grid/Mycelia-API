import "express";
import type { JwtAuthClaims } from "@/types/auth-claims";

declare module "express-serve-static-core" {
    interface Request {
        /** Supabase JWT のデコード済みクレーム */
        authClaims?: JwtAuthClaims;
    }
}
