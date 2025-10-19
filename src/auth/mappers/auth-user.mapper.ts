import type { User } from "@supabase/supabase-js";
import {
    AuthUserDto,
    AuthUserFactorDto,
    AuthUserIdentityDto,
} from "@/auth/dto/auth-user.dto";

export function mapAuthUserToDto(user?: User | null): AuthUserDto | null {
    if (!user) {
        return null;
    }

    const dto = new AuthUserDto({
        id: user.id,
        aud: user.aud,
        email: user.email ?? null,
        phone: user.phone ?? null,
        createdAt: user.created_at,
        confirmedAt: user.confirmed_at ?? null,
        emailConfirmedAt: user.email_confirmed_at ?? null,
        phoneConfirmedAt: user.phone_confirmed_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        role: user.role ?? null,
        updatedAt: user.updated_at ?? null,
        appMetadata: user.app_metadata ?? {},
        userMetadata: user.user_metadata ?? {},
        isAnonymous: user.is_anonymous ?? false,
        isSsoUser: user.is_sso_user ?? false,
        newEmail: user.new_email ?? null,
        newPhone: user.new_phone ?? null,
        invitedAt: user.invited_at ?? null,
        actionLink: user.action_link ?? null,
        confirmationSentAt: user.confirmation_sent_at ?? null,
        recoverySentAt: user.recovery_sent_at ?? null,
        emailChangeSentAt: user.email_change_sent_at ?? null,
        deletedAt: user.deleted_at ?? null,
    });

    dto.identities = (user.identities ?? []).map(
        (identity) =>
            new AuthUserIdentityDto({
                id: identity.id,
                userId: identity.user_id,
                identityId: identity.identity_id,
                provider: identity.provider,
                identityData: identity.identity_data ?? {},
                createdAt: identity.created_at ?? null,
                lastSignInAt: identity.last_sign_in_at ?? null,
                updatedAt: identity.updated_at ?? null,
            }),
    );

    dto.factors = (user.factors ?? []).map(
        (factor) =>
            new AuthUserFactorDto({
                id: factor.id,
                friendlyName: factor.friendly_name ?? null,
                factorType: factor.factor_type,
                status: factor.status,
                createdAt: factor.created_at,
                updatedAt: factor.updated_at,
            }),
    );

    return dto;
}
