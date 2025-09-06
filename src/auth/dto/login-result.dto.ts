import type { User } from "@supabase/supabase-js";

export class LoginResultDto {
    /** Authenticated user or null */
    user!: User | null;
}
