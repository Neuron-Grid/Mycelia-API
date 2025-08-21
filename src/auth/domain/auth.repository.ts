export abstract class AuthRepositoryPort {
    abstract signUp(
        email: string,
        password: string,
        username: string,
    ): Promise<unknown>;
    abstract signIn(email: string, password: string): Promise<unknown>;
    abstract signOut(): Promise<void>;
    abstract deleteAccount(userId: string): Promise<unknown>;
    abstract updateEmail(userId: string, newEmail: string): Promise<unknown>;
    abstract updateUsername(
        userId: string,
        newUsername: string,
    ): Promise<unknown>;
    abstract updatePassword(
        userId: string,
        userEmail: string,
        oldPassword: string,
        newPassword: string,
    ): Promise<unknown>;
    abstract forgotPassword(
        email: string,
        redirectUrl: string,
    ): Promise<unknown>;
    abstract resetPassword(
        accessToken: string,
        newPassword: string,
    ): Promise<unknown>;
    abstract verifyEmail(email: string, token: string): Promise<unknown>;
    abstract verifyTotp(factorId: string, code: string): Promise<unknown>;

    // リフレッシュトークンからアクセストークンを再発行
    abstract refreshAccessToken(
        refreshToken: string,
    ): Promise<{ access_token: string; refresh_token?: string }>;
}
