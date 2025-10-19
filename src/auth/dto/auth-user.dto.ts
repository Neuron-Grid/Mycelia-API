export class AuthUserFactorDto {
    /** MFA factor ID */
    id!: string;
    /** Optional friendly name */
    friendlyName: string | null;
    /** Factor type */
    factorType!: "totp" | "phone" | "webauthn";
    /** Verification status */
    status!: "verified" | "unverified";
    /** Created timestamp (ISO) */
    createdAt!: string;
    /** Updated timestamp (ISO) */
    updatedAt!: string;

    constructor(init?: Partial<AuthUserFactorDto>) {
        this.friendlyName = null;
        Object.assign(this, init);
    }
}

export class AuthUserIdentityDto {
    /** Identity record ID */
    id!: string;
    /** Related user ID */
    userId!: string;
    /** Provider-specific identity ID */
    identityId!: string;
    /** Identity provider key */
    provider!: string;
    /** Additional identity data */
    identityData: Record<string, unknown>;
    /** Created timestamp (ISO) */
    createdAt: string | null;
    /** Last sign-in timestamp (ISO) */
    lastSignInAt: string | null;
    /** Updated timestamp (ISO) */
    updatedAt: string | null;

    constructor(init?: Partial<AuthUserIdentityDto>) {
        this.identityData = {};
        this.createdAt = null;
        this.lastSignInAt = null;
        this.updatedAt = null;
        Object.assign(this, init);
    }
}

export class AuthUserDto {
    /** User ID (UUID) */
    id!: string;
    /** Audience */
    aud!: string;
    /** Email address */
    email: string | null;
    /** Phone number */
    phone: string | null;
    /** Account creation timestamp (ISO) */
    createdAt!: string;
    /** Account confirmation timestamp (ISO) */
    confirmedAt: string | null;
    /** Email confirmation timestamp (ISO) */
    emailConfirmedAt: string | null;
    /** Phone confirmation timestamp (ISO) */
    phoneConfirmedAt: string | null;
    /** Last sign-in timestamp (ISO) */
    lastSignInAt: string | null;
    /** Custom role */
    role: string | null;
    /** Updated timestamp (ISO) */
    updatedAt: string | null;
    /** Supabase app metadata */
    appMetadata: Record<string, unknown>;
    /** Supabase user metadata */
    userMetadata: Record<string, unknown>;
    /** Whether the user is anonymous */
    isAnonymous: boolean;
    /** Whether the user is an SSO account */
    isSsoUser: boolean;
    /** Pending email change */
    newEmail: string | null;
    /** Pending phone change */
    newPhone: string | null;
    /** Invitation timestamp (ISO) */
    invitedAt: string | null;
    /** Action link (if any) */
    actionLink: string | null;
    /** Confirmation mail sent at (ISO) */
    confirmationSentAt: string | null;
    /** Recovery mail sent at (ISO) */
    recoverySentAt: string | null;
    /** Email change mail sent at (ISO) */
    emailChangeSentAt: string | null;
    /** Soft delete timestamp */
    deletedAt: string | null;
    /** Linked identities */
    identities: AuthUserIdentityDto[];
    /** Registered MFA factors */
    factors: AuthUserFactorDto[];

    constructor(init?: Partial<AuthUserDto>) {
        this.email = null;
        this.phone = null;
        this.confirmedAt = null;
        this.emailConfirmedAt = null;
        this.phoneConfirmedAt = null;
        this.lastSignInAt = null;
        this.role = null;
        this.updatedAt = null;
        this.appMetadata = {};
        this.userMetadata = {};
        this.isAnonymous = false;
        this.isSsoUser = false;
        this.newEmail = null;
        this.newPhone = null;
        this.invitedAt = null;
        this.actionLink = null;
        this.confirmationSentAt = null;
        this.recoverySentAt = null;
        this.emailChangeSentAt = null;
        this.deletedAt = null;
        this.identities = [];
        this.factors = [];
        Object.assign(this, init);
    }
}
