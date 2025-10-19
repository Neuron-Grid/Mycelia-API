import type { AuthUserDto } from "@/auth/dto/auth-user.dto";

export class LoginResultDto {
    /** Authenticated user or null */
    user!: AuthUserDto | null;
}
