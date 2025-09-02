/**
 * Supabase Auth MFA – WebAuthn type augmentation
 * Adds missing “webauthn” support to the SDK typings and
 * removes the need for “as any” casts in our repository layer.
 *
 * NOTE:
 *  - This file is placed under src/types/ and is automatically
 *    included by the TypeScript compiler via the “typeRoots” / “include”
 *    settings in tsconfig.json (default NestJS config already picks it up).
 *  - No runtime code is emitted; purely compile-time augmentation.
 */

import "@supabase/supabase-js";

declare module "@supabase/supabase-js" {
    /* ------------------------------------------------------------------
     * Enroll
     * ------------------------------------------------------------------ */
    /** Params for enrolling a WebAuthn (passkey) factor */
    interface MFAEnrollWebAuthnParams {
        factorType: "webauthn";
        /** Optional display name shown in Supabase dashboard */
        friendlyName?: string;
    }

    /* ------------------------------------------------------------------
     * Verify
     * ------------------------------------------------------------------ */
    /** Params when finishing registration (attestation) */
    interface MFAVerifyWebAuthnAttestationParams {
        attestationResponse: Record<string, unknown>;
    }

    /** Params when verifying a login assertion */
    interface MFAVerifyWebAuthnAssertionParams {
        assertionResponse: Record<string, unknown>;
    }

    /* ------------------------------------------------------------------
     * API augmentation
     * ------------------------------------------------------------------ */
    interface AuthMFAApi {
        /** Enroll (register) WebAuthn factor */
        enroll(
            params: MFAEnrollWebAuthnParams,
        ): Promise<import("@supabase/auth-js").AuthMFAEnrollResponse>;

        /** Finish WebAuthn registration */
        verify(
            params: MFAVerifyWebAuthnAttestationParams,
        ): Promise<import("@supabase/auth-js").AuthMFAEnrollResponse>;

        /** Verify a WebAuthn login assertion */
        verify(
            params: MFAVerifyWebAuthnAssertionParams,
        ): Promise<import("@supabase/auth-js").AuthMFAEnrollResponse>;
    }
}
