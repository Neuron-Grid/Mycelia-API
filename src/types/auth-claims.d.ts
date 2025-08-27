/**
 * Supabase JWT payload (subset) augmented with decoded amr array etc.
 */
export interface JwtAuthClaims {
    /** User ID (UUID) */
    sub: string;
    /** Expiration epoch seconds */
    exp?: number;
    /** Issued-at epoch seconds */
    iat?: number;
    /** User email */
    email?: string;
    /** Supabase verified timestamp */
    email_confirmed_at?: string;
    /** Authentication methods array: [&#x27;totp&#x27;, &#x27;webauthn&#x27;, …] */
    amr?: string[];
    /** Authentication context class reference (e.g., &#x27;aal2&#x27;) */
    acr?: string;
    /** Authentication assurance level */
    aal?: string | number;
    /** Supabase app_metadata */
    app_metadata?: Record<string, unknown>;
    /** Supabase user_metadata */
    user_metadata?: Record<string, unknown>;
    /** Future-proof additional claims */
    [key: string]: unknown;
}
