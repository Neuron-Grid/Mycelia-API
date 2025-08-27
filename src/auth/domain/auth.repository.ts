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

    /* ------------------------------------------------------------------
     * WebAuthn (パスキー) 関連
     * ------------------------------------------------------------------ */
    /**
     * WebAuthn 登録開始（CreateCredentialOptions 生成）
     * @param displayName - デバイス表示名（例: "MacBook Pro TouchID"）
     * @returns PublicKeyCredentialCreationOptions 等を JSON で返却
     */
    abstract startWebAuthnRegistration(
        displayName?: string,
    ): Promise<Record<string, unknown>>;

    /**
     * WebAuthn 登録完了（クライアントから返った credential を検証）
     * @param attestationResponse - navigator.credentials.create() の結果(JSON)
     */
    abstract finishWebAuthnRegistration(
        attestationResponse: Record<string, unknown>,
    ): Promise<unknown>;

    /**
     * WebAuthn 認証検証（navigator.credentials.get() の結果を検証）
     * @param assertionResponse - クライアント署名済みレスポンス(JSON)
     */
    abstract verifyWebAuthnAssertion(
        assertionResponse: Record<string, unknown>,
    ): Promise<unknown>;

    /** TOTP 要素を登録し、QR などを返す */
    abstract enrollTotp(
        displayName?: string,
    ): Promise<{ id: string; otpauthUri: string }>;
    /** 既存 TOTP 要素を無効化（削除） */
    abstract disableTotp(factorId: string): Promise<unknown>;

    // リフレッシュトークンからアクセストークンを再発行
    abstract refreshAccessToken(
        refreshToken: string,
    ): Promise<{ access_token: string; refresh_token?: string }>;
}
