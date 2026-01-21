export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "13.0.5";
    };
    auth: {
        Tables: {
            audit_log_entries: {
                Row: {
                    created_at: string | null;
                    id: string;
                    instance_id: string | null;
                    ip_address: string;
                    payload: Json | null;
                };
                Insert: {
                    created_at?: string | null;
                    id: string;
                    instance_id?: string | null;
                    ip_address?: string;
                    payload?: Json | null;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    instance_id?: string | null;
                    ip_address?: string;
                    payload?: Json | null;
                };
                Relationships: [];
            };
            flow_state: {
                Row: {
                    auth_code: string;
                    auth_code_issued_at: string | null;
                    authentication_method: string;
                    code_challenge: string;
                    code_challenge_method: Database["auth"]["Enums"]["code_challenge_method"];
                    created_at: string | null;
                    id: string;
                    provider_access_token: string | null;
                    provider_refresh_token: string | null;
                    provider_type: string;
                    updated_at: string | null;
                    user_id: string | null;
                };
                Insert: {
                    auth_code: string;
                    auth_code_issued_at?: string | null;
                    authentication_method: string;
                    code_challenge: string;
                    code_challenge_method: Database["auth"]["Enums"]["code_challenge_method"];
                    created_at?: string | null;
                    id: string;
                    provider_access_token?: string | null;
                    provider_refresh_token?: string | null;
                    provider_type: string;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Update: {
                    auth_code?: string;
                    auth_code_issued_at?: string | null;
                    authentication_method?: string;
                    code_challenge?: string;
                    code_challenge_method?: Database["auth"]["Enums"]["code_challenge_method"];
                    created_at?: string | null;
                    id?: string;
                    provider_access_token?: string | null;
                    provider_refresh_token?: string | null;
                    provider_type?: string;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Relationships: [];
            };
            identities: {
                Row: {
                    created_at: string | null;
                    email: string | null;
                    id: string;
                    identity_data: Json;
                    last_sign_in_at: string | null;
                    provider: string;
                    provider_id: string;
                    updated_at: string | null;
                    user_id: string;
                };
                Insert: {
                    created_at?: string | null;
                    email?: string | null;
                    id?: string;
                    identity_data: Json;
                    last_sign_in_at?: string | null;
                    provider: string;
                    provider_id: string;
                    updated_at?: string | null;
                    user_id: string;
                };
                Update: {
                    created_at?: string | null;
                    email?: string | null;
                    id?: string;
                    identity_data?: Json;
                    last_sign_in_at?: string | null;
                    provider?: string;
                    provider_id?: string;
                    updated_at?: string | null;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "identities_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    },
                ];
            };
            instances: {
                Row: {
                    created_at: string | null;
                    id: string;
                    raw_base_config: string | null;
                    updated_at: string | null;
                    uuid: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    id: string;
                    raw_base_config?: string | null;
                    updated_at?: string | null;
                    uuid?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    id?: string;
                    raw_base_config?: string | null;
                    updated_at?: string | null;
                    uuid?: string | null;
                };
                Relationships: [];
            };
            mfa_amr_claims: {
                Row: {
                    authentication_method: string;
                    created_at: string;
                    id: string;
                    session_id: string;
                    updated_at: string;
                };
                Insert: {
                    authentication_method: string;
                    created_at: string;
                    id: string;
                    session_id: string;
                    updated_at: string;
                };
                Update: {
                    authentication_method?: string;
                    created_at?: string;
                    id?: string;
                    session_id?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "mfa_amr_claims_session_id_fkey";
                        columns: ["session_id"];
                        isOneToOne: false;
                        referencedRelation: "sessions";
                        referencedColumns: ["id"];
                    },
                ];
            };
            mfa_challenges: {
                Row: {
                    created_at: string;
                    factor_id: string;
                    id: string;
                    ip_address: unknown;
                    otp_code: string | null;
                    verified_at: string | null;
                    web_authn_session_data: Json | null;
                };
                Insert: {
                    created_at: string;
                    factor_id: string;
                    id: string;
                    ip_address: unknown;
                    otp_code?: string | null;
                    verified_at?: string | null;
                    web_authn_session_data?: Json | null;
                };
                Update: {
                    created_at?: string;
                    factor_id?: string;
                    id?: string;
                    ip_address?: unknown;
                    otp_code?: string | null;
                    verified_at?: string | null;
                    web_authn_session_data?: Json | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "mfa_challenges_auth_factor_id_fkey";
                        columns: ["factor_id"];
                        isOneToOne: false;
                        referencedRelation: "mfa_factors";
                        referencedColumns: ["id"];
                    },
                ];
            };
            mfa_factors: {
                Row: {
                    created_at: string;
                    factor_type: Database["auth"]["Enums"]["factor_type"];
                    friendly_name: string | null;
                    id: string;
                    last_challenged_at: string | null;
                    last_webauthn_challenge_data: Json | null;
                    phone: string | null;
                    secret: string | null;
                    status: Database["auth"]["Enums"]["factor_status"];
                    updated_at: string;
                    user_id: string;
                    web_authn_aaguid: string | null;
                    web_authn_credential: Json | null;
                };
                Insert: {
                    created_at: string;
                    factor_type: Database["auth"]["Enums"]["factor_type"];
                    friendly_name?: string | null;
                    id: string;
                    last_challenged_at?: string | null;
                    last_webauthn_challenge_data?: Json | null;
                    phone?: string | null;
                    secret?: string | null;
                    status: Database["auth"]["Enums"]["factor_status"];
                    updated_at: string;
                    user_id: string;
                    web_authn_aaguid?: string | null;
                    web_authn_credential?: Json | null;
                };
                Update: {
                    created_at?: string;
                    factor_type?: Database["auth"]["Enums"]["factor_type"];
                    friendly_name?: string | null;
                    id?: string;
                    last_challenged_at?: string | null;
                    last_webauthn_challenge_data?: Json | null;
                    phone?: string | null;
                    secret?: string | null;
                    status?: Database["auth"]["Enums"]["factor_status"];
                    updated_at?: string;
                    user_id?: string;
                    web_authn_aaguid?: string | null;
                    web_authn_credential?: Json | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "mfa_factors_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    },
                ];
            };
            oauth_authorizations: {
                Row: {
                    approved_at: string | null;
                    authorization_code: string | null;
                    authorization_id: string;
                    client_id: string;
                    code_challenge: string | null;
                    code_challenge_method:
                        | Database["auth"]["Enums"]["code_challenge_method"]
                        | null;
                    created_at: string;
                    expires_at: string;
                    id: string;
                    nonce: string | null;
                    redirect_uri: string;
                    resource: string | null;
                    response_type: Database["auth"]["Enums"]["oauth_response_type"];
                    scope: string;
                    state: string | null;
                    status: Database["auth"]["Enums"]["oauth_authorization_status"];
                    user_id: string | null;
                };
                Insert: {
                    approved_at?: string | null;
                    authorization_code?: string | null;
                    authorization_id: string;
                    client_id: string;
                    code_challenge?: string | null;
                    code_challenge_method?:
                        | Database["auth"]["Enums"]["code_challenge_method"]
                        | null;
                    created_at?: string;
                    expires_at?: string;
                    id: string;
                    nonce?: string | null;
                    redirect_uri: string;
                    resource?: string | null;
                    response_type?: Database["auth"]["Enums"]["oauth_response_type"];
                    scope: string;
                    state?: string | null;
                    status?: Database["auth"]["Enums"]["oauth_authorization_status"];
                    user_id?: string | null;
                };
                Update: {
                    approved_at?: string | null;
                    authorization_code?: string | null;
                    authorization_id?: string;
                    client_id?: string;
                    code_challenge?: string | null;
                    code_challenge_method?:
                        | Database["auth"]["Enums"]["code_challenge_method"]
                        | null;
                    created_at?: string;
                    expires_at?: string;
                    id?: string;
                    nonce?: string | null;
                    redirect_uri?: string;
                    resource?: string | null;
                    response_type?: Database["auth"]["Enums"]["oauth_response_type"];
                    scope?: string;
                    state?: string | null;
                    status?: Database["auth"]["Enums"]["oauth_authorization_status"];
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "oauth_authorizations_client_id_fkey";
                        columns: ["client_id"];
                        isOneToOne: false;
                        referencedRelation: "oauth_clients";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "oauth_authorizations_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    },
                ];
            };
            oauth_client_states: {
                Row: {
                    code_verifier: string | null;
                    created_at: string;
                    id: string;
                    provider_type: string;
                };
                Insert: {
                    code_verifier?: string | null;
                    created_at: string;
                    id: string;
                    provider_type: string;
                };
                Update: {
                    code_verifier?: string | null;
                    created_at?: string;
                    id?: string;
                    provider_type?: string;
                };
                Relationships: [];
            };
            oauth_clients: {
                Row: {
                    client_name: string | null;
                    client_secret_hash: string | null;
                    client_type: Database["auth"]["Enums"]["oauth_client_type"];
                    client_uri: string | null;
                    created_at: string;
                    deleted_at: string | null;
                    grant_types: string;
                    id: string;
                    logo_uri: string | null;
                    redirect_uris: string;
                    registration_type: Database["auth"]["Enums"]["oauth_registration_type"];
                    updated_at: string;
                };
                Insert: {
                    client_name?: string | null;
                    client_secret_hash?: string | null;
                    client_type?: Database["auth"]["Enums"]["oauth_client_type"];
                    client_uri?: string | null;
                    created_at?: string;
                    deleted_at?: string | null;
                    grant_types: string;
                    id: string;
                    logo_uri?: string | null;
                    redirect_uris: string;
                    registration_type: Database["auth"]["Enums"]["oauth_registration_type"];
                    updated_at?: string;
                };
                Update: {
                    client_name?: string | null;
                    client_secret_hash?: string | null;
                    client_type?: Database["auth"]["Enums"]["oauth_client_type"];
                    client_uri?: string | null;
                    created_at?: string;
                    deleted_at?: string | null;
                    grant_types?: string;
                    id?: string;
                    logo_uri?: string | null;
                    redirect_uris?: string;
                    registration_type?: Database["auth"]["Enums"]["oauth_registration_type"];
                    updated_at?: string;
                };
                Relationships: [];
            };
            oauth_consents: {
                Row: {
                    client_id: string;
                    granted_at: string;
                    id: string;
                    revoked_at: string | null;
                    scopes: string;
                    user_id: string;
                };
                Insert: {
                    client_id: string;
                    granted_at?: string;
                    id: string;
                    revoked_at?: string | null;
                    scopes: string;
                    user_id: string;
                };
                Update: {
                    client_id?: string;
                    granted_at?: string;
                    id?: string;
                    revoked_at?: string | null;
                    scopes?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "oauth_consents_client_id_fkey";
                        columns: ["client_id"];
                        isOneToOne: false;
                        referencedRelation: "oauth_clients";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "oauth_consents_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    },
                ];
            };
            one_time_tokens: {
                Row: {
                    created_at: string;
                    id: string;
                    relates_to: string;
                    token_hash: string;
                    token_type: Database["auth"]["Enums"]["one_time_token_type"];
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    id: string;
                    relates_to: string;
                    token_hash: string;
                    token_type: Database["auth"]["Enums"]["one_time_token_type"];
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    relates_to?: string;
                    token_hash?: string;
                    token_type?: Database["auth"]["Enums"]["one_time_token_type"];
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "one_time_tokens_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    },
                ];
            };
            refresh_tokens: {
                Row: {
                    created_at: string | null;
                    id: number;
                    instance_id: string | null;
                    parent: string | null;
                    revoked: boolean | null;
                    session_id: string | null;
                    token: string | null;
                    updated_at: string | null;
                    user_id: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    id?: number;
                    instance_id?: string | null;
                    parent?: string | null;
                    revoked?: boolean | null;
                    session_id?: string | null;
                    token?: string | null;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    id?: number;
                    instance_id?: string | null;
                    parent?: string | null;
                    revoked?: boolean | null;
                    session_id?: string | null;
                    token?: string | null;
                    updated_at?: string | null;
                    user_id?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "refresh_tokens_session_id_fkey";
                        columns: ["session_id"];
                        isOneToOne: false;
                        referencedRelation: "sessions";
                        referencedColumns: ["id"];
                    },
                ];
            };
            saml_providers: {
                Row: {
                    attribute_mapping: Json | null;
                    created_at: string | null;
                    entity_id: string;
                    id: string;
                    metadata_url: string | null;
                    metadata_xml: string;
                    name_id_format: string | null;
                    sso_provider_id: string;
                    updated_at: string | null;
                };
                Insert: {
                    attribute_mapping?: Json | null;
                    created_at?: string | null;
                    entity_id: string;
                    id: string;
                    metadata_url?: string | null;
                    metadata_xml: string;
                    name_id_format?: string | null;
                    sso_provider_id: string;
                    updated_at?: string | null;
                };
                Update: {
                    attribute_mapping?: Json | null;
                    created_at?: string | null;
                    entity_id?: string;
                    id?: string;
                    metadata_url?: string | null;
                    metadata_xml?: string;
                    name_id_format?: string | null;
                    sso_provider_id?: string;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "saml_providers_sso_provider_id_fkey";
                        columns: ["sso_provider_id"];
                        isOneToOne: false;
                        referencedRelation: "sso_providers";
                        referencedColumns: ["id"];
                    },
                ];
            };
            saml_relay_states: {
                Row: {
                    created_at: string | null;
                    flow_state_id: string | null;
                    for_email: string | null;
                    id: string;
                    redirect_to: string | null;
                    request_id: string;
                    sso_provider_id: string;
                    updated_at: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    flow_state_id?: string | null;
                    for_email?: string | null;
                    id: string;
                    redirect_to?: string | null;
                    request_id: string;
                    sso_provider_id: string;
                    updated_at?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    flow_state_id?: string | null;
                    for_email?: string | null;
                    id?: string;
                    redirect_to?: string | null;
                    request_id?: string;
                    sso_provider_id?: string;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "saml_relay_states_flow_state_id_fkey";
                        columns: ["flow_state_id"];
                        isOneToOne: false;
                        referencedRelation: "flow_state";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "saml_relay_states_sso_provider_id_fkey";
                        columns: ["sso_provider_id"];
                        isOneToOne: false;
                        referencedRelation: "sso_providers";
                        referencedColumns: ["id"];
                    },
                ];
            };
            schema_migrations: {
                Row: {
                    version: string;
                };
                Insert: {
                    version: string;
                };
                Update: {
                    version?: string;
                };
                Relationships: [];
            };
            sessions: {
                Row: {
                    aal: Database["auth"]["Enums"]["aal_level"] | null;
                    created_at: string | null;
                    factor_id: string | null;
                    id: string;
                    ip: unknown;
                    not_after: string | null;
                    oauth_client_id: string | null;
                    refresh_token_counter: number | null;
                    refresh_token_hmac_key: string | null;
                    refreshed_at: string | null;
                    scopes: string | null;
                    tag: string | null;
                    updated_at: string | null;
                    user_agent: string | null;
                    user_id: string;
                };
                Insert: {
                    aal?: Database["auth"]["Enums"]["aal_level"] | null;
                    created_at?: string | null;
                    factor_id?: string | null;
                    id: string;
                    ip?: unknown;
                    not_after?: string | null;
                    oauth_client_id?: string | null;
                    refresh_token_counter?: number | null;
                    refresh_token_hmac_key?: string | null;
                    refreshed_at?: string | null;
                    scopes?: string | null;
                    tag?: string | null;
                    updated_at?: string | null;
                    user_agent?: string | null;
                    user_id: string;
                };
                Update: {
                    aal?: Database["auth"]["Enums"]["aal_level"] | null;
                    created_at?: string | null;
                    factor_id?: string | null;
                    id?: string;
                    ip?: unknown;
                    not_after?: string | null;
                    oauth_client_id?: string | null;
                    refresh_token_counter?: number | null;
                    refresh_token_hmac_key?: string | null;
                    refreshed_at?: string | null;
                    scopes?: string | null;
                    tag?: string | null;
                    updated_at?: string | null;
                    user_agent?: string | null;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "sessions_oauth_client_id_fkey";
                        columns: ["oauth_client_id"];
                        isOneToOne: false;
                        referencedRelation: "oauth_clients";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "sessions_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    },
                ];
            };
            sso_domains: {
                Row: {
                    created_at: string | null;
                    domain: string;
                    id: string;
                    sso_provider_id: string;
                    updated_at: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    domain: string;
                    id: string;
                    sso_provider_id: string;
                    updated_at?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    domain?: string;
                    id?: string;
                    sso_provider_id?: string;
                    updated_at?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "sso_domains_sso_provider_id_fkey";
                        columns: ["sso_provider_id"];
                        isOneToOne: false;
                        referencedRelation: "sso_providers";
                        referencedColumns: ["id"];
                    },
                ];
            };
            sso_providers: {
                Row: {
                    created_at: string | null;
                    disabled: boolean | null;
                    id: string;
                    resource_id: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    created_at?: string | null;
                    disabled?: boolean | null;
                    id: string;
                    resource_id?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    created_at?: string | null;
                    disabled?: boolean | null;
                    id?: string;
                    resource_id?: string | null;
                    updated_at?: string | null;
                };
                Relationships: [];
            };
            users: {
                Row: {
                    aud: string | null;
                    banned_until: string | null;
                    confirmation_sent_at: string | null;
                    confirmation_token: string | null;
                    confirmed_at: string | null;
                    created_at: string | null;
                    deleted_at: string | null;
                    email: string | null;
                    email_change: string | null;
                    email_change_confirm_status: number | null;
                    email_change_sent_at: string | null;
                    email_change_token_current: string | null;
                    email_change_token_new: string | null;
                    email_confirmed_at: string | null;
                    encrypted_password: string | null;
                    id: string;
                    instance_id: string | null;
                    invited_at: string | null;
                    is_anonymous: boolean;
                    is_sso_user: boolean;
                    is_super_admin: boolean | null;
                    last_sign_in_at: string | null;
                    phone: string | null;
                    phone_change: string | null;
                    phone_change_sent_at: string | null;
                    phone_change_token: string | null;
                    phone_confirmed_at: string | null;
                    raw_app_meta_data: Json | null;
                    raw_user_meta_data: Json | null;
                    reauthentication_sent_at: string | null;
                    reauthentication_token: string | null;
                    recovery_sent_at: string | null;
                    recovery_token: string | null;
                    role: string | null;
                    updated_at: string | null;
                };
                Insert: {
                    aud?: string | null;
                    banned_until?: string | null;
                    confirmation_sent_at?: string | null;
                    confirmation_token?: string | null;
                    confirmed_at?: string | null;
                    created_at?: string | null;
                    deleted_at?: string | null;
                    email?: string | null;
                    email_change?: string | null;
                    email_change_confirm_status?: number | null;
                    email_change_sent_at?: string | null;
                    email_change_token_current?: string | null;
                    email_change_token_new?: string | null;
                    email_confirmed_at?: string | null;
                    encrypted_password?: string | null;
                    id: string;
                    instance_id?: string | null;
                    invited_at?: string | null;
                    is_anonymous?: boolean;
                    is_sso_user?: boolean;
                    is_super_admin?: boolean | null;
                    last_sign_in_at?: string | null;
                    phone?: string | null;
                    phone_change?: string | null;
                    phone_change_sent_at?: string | null;
                    phone_change_token?: string | null;
                    phone_confirmed_at?: string | null;
                    raw_app_meta_data?: Json | null;
                    raw_user_meta_data?: Json | null;
                    reauthentication_sent_at?: string | null;
                    reauthentication_token?: string | null;
                    recovery_sent_at?: string | null;
                    recovery_token?: string | null;
                    role?: string | null;
                    updated_at?: string | null;
                };
                Update: {
                    aud?: string | null;
                    banned_until?: string | null;
                    confirmation_sent_at?: string | null;
                    confirmation_token?: string | null;
                    confirmed_at?: string | null;
                    created_at?: string | null;
                    deleted_at?: string | null;
                    email?: string | null;
                    email_change?: string | null;
                    email_change_confirm_status?: number | null;
                    email_change_sent_at?: string | null;
                    email_change_token_current?: string | null;
                    email_change_token_new?: string | null;
                    email_confirmed_at?: string | null;
                    encrypted_password?: string | null;
                    id?: string;
                    instance_id?: string | null;
                    invited_at?: string | null;
                    is_anonymous?: boolean;
                    is_sso_user?: boolean;
                    is_super_admin?: boolean | null;
                    last_sign_in_at?: string | null;
                    phone?: string | null;
                    phone_change?: string | null;
                    phone_change_sent_at?: string | null;
                    phone_change_token?: string | null;
                    phone_confirmed_at?: string | null;
                    raw_app_meta_data?: Json | null;
                    raw_user_meta_data?: Json | null;
                    reauthentication_sent_at?: string | null;
                    reauthentication_token?: string | null;
                    recovery_sent_at?: string | null;
                    recovery_token?: string | null;
                    role?: string | null;
                    updated_at?: string | null;
                };
                Relationships: [];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            email: { Args: never; Returns: string };
            jwt: { Args: never; Returns: Json };
            role: { Args: never; Returns: string };
            uid: { Args: never; Returns: string };
        };
        Enums: {
            aal_level: "aal1" | "aal2" | "aal3";
            code_challenge_method: "s256" | "plain";
            factor_status: "unverified" | "verified";
            factor_type: "totp" | "webauthn" | "phone";
            oauth_authorization_status:
                | "pending"
                | "approved"
                | "denied"
                | "expired";
            oauth_client_type: "public" | "confidential";
            oauth_registration_type: "dynamic" | "manual";
            oauth_response_type: "code";
            one_time_token_type:
                | "confirmation_token"
                | "reauthentication_token"
                | "recovery_token"
                | "email_change_token_new"
                | "email_change_token_current"
                | "phone_change_token";
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
    extensions: {
        Tables: {
            [_ in never]: never;
        };
        Views: {
            pg_stat_statements: {
                Row: {
                    calls: number | null;
                    dbid: unknown;
                    jit_deform_count: number | null;
                    jit_deform_time: number | null;
                    jit_emission_count: number | null;
                    jit_emission_time: number | null;
                    jit_functions: number | null;
                    jit_generation_time: number | null;
                    jit_inlining_count: number | null;
                    jit_inlining_time: number | null;
                    jit_optimization_count: number | null;
                    jit_optimization_time: number | null;
                    local_blk_read_time: number | null;
                    local_blk_write_time: number | null;
                    local_blks_dirtied: number | null;
                    local_blks_hit: number | null;
                    local_blks_read: number | null;
                    local_blks_written: number | null;
                    max_exec_time: number | null;
                    max_plan_time: number | null;
                    mean_exec_time: number | null;
                    mean_plan_time: number | null;
                    min_exec_time: number | null;
                    min_plan_time: number | null;
                    minmax_stats_since: string | null;
                    plans: number | null;
                    query: string | null;
                    queryid: number | null;
                    rows: number | null;
                    shared_blk_read_time: number | null;
                    shared_blk_write_time: number | null;
                    shared_blks_dirtied: number | null;
                    shared_blks_hit: number | null;
                    shared_blks_read: number | null;
                    shared_blks_written: number | null;
                    stats_since: string | null;
                    stddev_exec_time: number | null;
                    stddev_plan_time: number | null;
                    temp_blk_read_time: number | null;
                    temp_blk_write_time: number | null;
                    temp_blks_read: number | null;
                    temp_blks_written: number | null;
                    toplevel: boolean | null;
                    total_exec_time: number | null;
                    total_plan_time: number | null;
                    userid: unknown;
                    wal_bytes: number | null;
                    wal_fpi: number | null;
                    wal_records: number | null;
                };
                Relationships: [];
            };
            pg_stat_statements_info: {
                Row: {
                    dealloc: number | null;
                    stats_reset: string | null;
                };
                Relationships: [];
            };
        };
        Functions: {
            dearmor: { Args: { "": string }; Returns: string };
            gen_random_uuid: { Args: never; Returns: string };
            gen_salt: { Args: { "": string }; Returns: string };
            pg_stat_statements: {
                Args: { showtext: boolean };
                Returns: Record<string, unknown>[];
            };
            pg_stat_statements_info: {
                Args: never;
                Returns: Record<string, unknown>;
            };
            pg_stat_statements_reset: {
                Args: {
                    dbid?: unknown;
                    minmax_only?: boolean;
                    queryid?: number;
                    userid?: unknown;
                };
                Returns: string;
            };
            pgp_armor_headers: {
                Args: { "": string };
                Returns: Record<string, unknown>[];
            };
            text2ltree: { Args: { "": string }; Returns: unknown };
            uuid_generate_v1: { Args: never; Returns: string };
            uuid_generate_v1mc: { Args: never; Returns: string };
            uuid_generate_v3: {
                Args: { name: string; namespace: string };
                Returns: string;
            };
            uuid_generate_v4: { Args: never; Returns: string };
            uuid_generate_v5: {
                Args: { name: string; namespace: string };
                Returns: string;
            };
            uuid_nil: { Args: never; Returns: string };
            uuid_ns_dns: { Args: never; Returns: string };
            uuid_ns_oid: { Args: never; Returns: string };
            uuid_ns_url: { Args: never; Returns: string };
            uuid_ns_x500: { Args: never; Returns: string };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
    public: {
        Tables: {
            daily_summaries: {
                Row: {
                    created_at: string;
                    id: number;
                    markdown: string;
                    script_text: string | null;
                    script_tts_duration_sec: number | null;
                    soft_deleted: boolean;
                    summary_date: string;
                    summary_emb: string | null;
                    summary_title: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: never;
                    markdown: string;
                    script_text?: string | null;
                    script_tts_duration_sec?: number | null;
                    soft_deleted?: boolean;
                    summary_date: string;
                    summary_emb?: string | null;
                    summary_title: string;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: never;
                    markdown?: string;
                    script_text?: string | null;
                    script_tts_duration_sec?: number | null;
                    soft_deleted?: boolean;
                    summary_date?: string;
                    summary_emb?: string | null;
                    summary_title?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "daily_summaries_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    },
                ];
            };
            daily_summary_items: {
                Row: {
                    feed_item_id: number;
                    soft_deleted: boolean;
                    summary_id: number;
                    user_id: string;
                };
                Insert: {
                    feed_item_id: number;
                    soft_deleted?: boolean;
                    summary_id: number;
                    user_id: string;
                };
                Update: {
                    feed_item_id?: number;
                    soft_deleted?: boolean;
                    summary_id?: number;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "daily_summary_items_feed_item_id_user_id_fkey";
                        columns: ["feed_item_id", "user_id"];
                        isOneToOne: false;
                        referencedRelation: "feed_items";
                        referencedColumns: ["id", "user_id"];
                    },
                    {
                        foreignKeyName: "daily_summary_items_summary_id_user_id_fkey";
                        columns: ["summary_id", "user_id"];
                        isOneToOne: false;
                        referencedRelation: "daily_summaries";
                        referencedColumns: ["id", "user_id"];
                    },
                ];
            };
            embedding_config: {
                Row: {
                    created_at: string;
                    dimensions: number;
                    id: number;
                    model_name: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    dimensions?: number;
                    id?: number;
                    model_name?: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    dimensions?: number;
                    id?: number;
                    model_name?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            feed_item_favorites: {
                Row: {
                    created_at: string;
                    feed_item_id: number;
                    id: number;
                    soft_deleted: boolean;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    feed_item_id: number;
                    id?: never;
                    soft_deleted?: boolean;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    feed_item_id?: number;
                    id?: never;
                    soft_deleted?: boolean;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "feed_item_favorites_feed_item_id_user_id_fkey";
                        columns: ["feed_item_id", "user_id"];
                        isOneToOne: false;
                        referencedRelation: "feed_items";
                        referencedColumns: ["id", "user_id"];
                    },
                ];
            };
            feed_item_tags: {
                Row: {
                    created_at: string;
                    feed_item_id: number;
                    id: number;
                    soft_deleted: boolean;
                    tag_id: number;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    feed_item_id: number;
                    id?: never;
                    soft_deleted?: boolean;
                    tag_id: number;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    feed_item_id?: number;
                    id?: never;
                    soft_deleted?: boolean;
                    tag_id?: number;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "feed_item_tags_feed_item_id_user_id_fkey";
                        columns: ["feed_item_id", "user_id"];
                        isOneToOne: false;
                        referencedRelation: "feed_items";
                        referencedColumns: ["id", "user_id"];
                    },
                    {
                        foreignKeyName: "feed_item_tags_tag_id_user_id_fkey";
                        columns: ["tag_id", "user_id"];
                        isOneToOne: false;
                        referencedRelation: "tags";
                        referencedColumns: ["id", "user_id"];
                    },
                ];
            };
            feed_items: {
                Row: {
                    canonical_url: string | null;
                    created_at: string;
                    description: string | null;
                    id: number;
                    link: string;
                    link_hash: string;
                    published_at: string | null;
                    soft_deleted: boolean;
                    title: string;
                    title_emb: string | null;
                    updated_at: string;
                    user_id: string;
                    user_subscription_id: number;
                };
                Insert: {
                    canonical_url?: string | null;
                    created_at?: string;
                    description?: string | null;
                    id?: never;
                    link: string;
                    link_hash: string;
                    published_at?: string | null;
                    soft_deleted?: boolean;
                    title: string;
                    title_emb?: string | null;
                    updated_at?: string;
                    user_id: string;
                    user_subscription_id: number;
                };
                Update: {
                    canonical_url?: string | null;
                    created_at?: string;
                    description?: string | null;
                    id?: never;
                    link?: string;
                    link_hash?: string;
                    published_at?: string | null;
                    soft_deleted?: boolean;
                    title?: string;
                    title_emb?: string | null;
                    updated_at?: string;
                    user_id?: string;
                    user_subscription_id?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "feed_items_user_subscription_id_user_id_fkey";
                        columns: ["user_subscription_id", "user_id"];
                        isOneToOne: false;
                        referencedRelation: "user_subscriptions";
                        referencedColumns: ["id", "user_id"];
                    },
                ];
            };
            podcast_episodes: {
                Row: {
                    audio_url: string;
                    created_at: string;
                    id: number;
                    soft_deleted: boolean;
                    summary_id: number;
                    title: string;
                    title_emb: string | null;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    audio_url: string;
                    created_at?: string;
                    id?: never;
                    soft_deleted?: boolean;
                    summary_id: number;
                    title: string;
                    title_emb?: string | null;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    audio_url?: string;
                    created_at?: string;
                    id?: never;
                    soft_deleted?: boolean;
                    summary_id?: number;
                    title?: string;
                    title_emb?: string | null;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "podcast_episodes_summary_id_user_id_fkey";
                        columns: ["summary_id", "user_id"];
                        isOneToOne: false;
                        referencedRelation: "daily_summaries";
                        referencedColumns: ["id", "user_id"];
                    },
                    {
                        foreignKeyName: "podcast_episodes_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    },
                ];
            };
            tags: {
                Row: {
                    color: string | null;
                    created_at: string;
                    description: string | null;
                    id: number;
                    parent_tag_id: number | null;
                    path: unknown;
                    soft_deleted: boolean;
                    tag_emb: string | null;
                    tag_name: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    color?: string | null;
                    created_at?: string;
                    description?: string | null;
                    id?: never;
                    parent_tag_id?: number | null;
                    path: unknown;
                    soft_deleted?: boolean;
                    tag_emb?: string | null;
                    tag_name: string;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    color?: string | null;
                    created_at?: string;
                    description?: string | null;
                    id?: never;
                    parent_tag_id?: number | null;
                    path?: unknown;
                    soft_deleted?: boolean;
                    tag_emb?: string | null;
                    tag_name?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "tags_parent_tag_id_user_id_fkey";
                        columns: ["parent_tag_id", "user_id"];
                        isOneToOne: false;
                        referencedRelation: "tags";
                        referencedColumns: ["id", "user_id"];
                    },
                    {
                        foreignKeyName: "tags_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    },
                ];
            };
            user_settings: {
                Row: {
                    created_at: string;
                    podcast_enabled: boolean;
                    podcast_language: string;
                    podcast_schedule_time: string | null;
                    refresh_every: unknown;
                    soft_deleted: boolean;
                    summary_enabled: boolean;
                    summary_schedule_time: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    podcast_enabled?: boolean;
                    podcast_language?: string;
                    podcast_schedule_time?: string | null;
                    refresh_every?: unknown;
                    soft_deleted?: boolean;
                    summary_enabled?: boolean;
                    summary_schedule_time?: string;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    podcast_enabled?: boolean;
                    podcast_language?: string;
                    podcast_schedule_time?: string | null;
                    refresh_every?: unknown;
                    soft_deleted?: boolean;
                    summary_enabled?: boolean;
                    summary_schedule_time?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "user_settings_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: true;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    },
                ];
            };
            user_subscription_tags: {
                Row: {
                    created_at: string;
                    id: number;
                    soft_deleted: boolean;
                    tag_id: number;
                    updated_at: string;
                    user_id: string;
                    user_subscription_id: number;
                };
                Insert: {
                    created_at?: string;
                    id?: never;
                    soft_deleted?: boolean;
                    tag_id: number;
                    updated_at?: string;
                    user_id: string;
                    user_subscription_id: number;
                };
                Update: {
                    created_at?: string;
                    id?: never;
                    soft_deleted?: boolean;
                    tag_id?: number;
                    updated_at?: string;
                    user_id?: string;
                    user_subscription_id?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "user_subscription_tags_tag_id_user_id_fkey";
                        columns: ["tag_id", "user_id"];
                        isOneToOne: false;
                        referencedRelation: "tags";
                        referencedColumns: ["id", "user_id"];
                    },
                    {
                        foreignKeyName: "user_subscription_tags_user_subscription_id_user_id_fkey";
                        columns: ["user_subscription_id", "user_id"];
                        isOneToOne: false;
                        referencedRelation: "user_subscriptions";
                        referencedColumns: ["id", "user_id"];
                    },
                ];
            };
            user_subscriptions: {
                Row: {
                    created_at: string;
                    feed_title: string | null;
                    feed_url: string;
                    id: number;
                    last_fetched_at: string | null;
                    next_fetch_at: string | null;
                    soft_deleted: boolean;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    feed_title?: string | null;
                    feed_url: string;
                    id?: never;
                    last_fetched_at?: string | null;
                    next_fetch_at?: string | null;
                    soft_deleted?: boolean;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    feed_title?: string | null;
                    feed_url?: string;
                    id?: never;
                    last_fetched_at?: string | null;
                    next_fetch_at?: string | null;
                    soft_deleted?: boolean;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "user_subscriptions_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    },
                ];
            };
            users: {
                Row: {
                    created_at: string;
                    deleted_at: string | null;
                    email: string;
                    id: string;
                    updated_at: string;
                    username: string;
                };
                Insert: {
                    created_at?: string;
                    deleted_at?: string | null;
                    email: string;
                    id: string;
                    updated_at?: string;
                    username: string;
                };
                Update: {
                    created_at?: string;
                    deleted_at?: string | null;
                    email?: string;
                    id?: string;
                    updated_at?: string;
                    username?: string;
                };
                Relationships: [];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            build_tag_node: {
                Args: { p_tag_id: number; p_user_id: string };
                Returns: Json;
            };
            compute_feed_item_hash: {
                Args: { p_canonical_url?: string; p_link: string };
                Returns: string;
            };
            fn_add_summary_items: {
                Args: {
                    p_feed_item_ids: number[];
                    p_summary_id: number;
                    p_user_id: string;
                };
                Returns: number;
            };
            fn_find_daily_summary_by_date: {
                Args: { p_summary_date: string; p_user_id: string };
                Returns: {
                    created_at: string;
                    id: number;
                    markdown: string;
                    script_tts_duration_sec: number;
                    soft_deleted: boolean;
                    summary_date: string;
                    summary_emb: string;
                    summary_title: string;
                    updated_at: string;
                    user_id: string;
                }[];
            };
            fn_find_daily_summary_by_id: {
                Args: { p_id: number; p_user_id: string };
                Returns: {
                    created_at: string;
                    id: number;
                    markdown: string;
                    script_tts_duration_sec: number;
                    soft_deleted: boolean;
                    summary_date: string;
                    summary_emb: string;
                    summary_title: string;
                    updated_at: string;
                    user_id: string;
                }[];
            };
            fn_find_due_subscriptions: {
                Args: { p_cutoff: string };
                Returns: {
                    feed_title: string;
                    feed_url: string;
                    id: number;
                    next_fetch_at: string;
                    user_id: string;
                }[];
            };
            fn_find_podcast_by_id: {
                Args: { p_id: number; p_user_id: string };
                Returns: {
                    audio_url: string;
                    created_at: string;
                    id: number;
                    soft_deleted: boolean;
                    summary_id: number;
                    title: string;
                    title_emb: string;
                    updated_at: string;
                    user_id: string;
                }[];
            };
            fn_find_podcast_by_summary_id: {
                Args: { p_summary_id: number; p_user_id: string };
                Returns: {
                    audio_url: string;
                    created_at: string;
                    id: number;
                    soft_deleted: boolean;
                    summary_id: number;
                    title: string;
                    title_emb: string;
                    updated_at: string;
                    user_id: string;
                }[];
            };
            fn_get_subscription_for_user: {
                Args: { p_subscription_id: number; p_user_id: string };
                Returns: {
                    feed_title: string;
                    feed_url: string;
                    id: number;
                    last_fetched_at: string;
                    next_fetch_at: string;
                    user_id: string;
                }[];
            };
            fn_get_summary_items: {
                Args: { p_summary_id: number; p_user_id: string };
                Returns: {
                    created_at: string;
                    feed_item_id: number;
                    id: number;
                    soft_deleted: boolean;
                    summary_id: number;
                    updated_at: string;
                    user_id: string;
                }[];
            };
            fn_get_user_settings: {
                Args: { p_user_id: string };
                Returns: {
                    podcast_enabled: boolean;
                    podcast_language: string;
                    podcast_schedule_time: string;
                    soft_deleted: boolean;
                    summary_enabled: boolean;
                    summary_schedule_time: string;
                    user_id: string;
                }[];
            };
            fn_insert_feed_item: {
                Args: {
                    p_canonical_url?: string;
                    p_description: string;
                    p_link: string;
                    p_published_at?: string;
                    p_subscription_id: number;
                    p_title: string;
                    p_user_id: string;
                };
                Returns: {
                    id: number;
                    inserted: boolean;
                }[];
            };
            fn_list_active_users: {
                Args: never;
                Returns: {
                    user_id: string;
                }[];
            };
            fn_list_enabled_podcast_schedules: {
                Args: { p_limit?: number; p_offset?: number };
                Returns: {
                    podcast_language: string;
                    podcast_schedule_time: string;
                    user_id: string;
                }[];
            };
            fn_list_enabled_summary_schedules: {
                Args: { p_limit?: number; p_offset?: number };
                Returns: {
                    summary_schedule_time: string;
                    user_id: string;
                }[];
            };
            fn_list_missing_feed_item_embeddings: {
                Args: {
                    p_last_id?: number;
                    p_limit?: number;
                    p_user_id: string;
                };
                Returns: {
                    description: string;
                    id: number;
                    title: string;
                }[];
            };
            fn_list_missing_podcast_embeddings: {
                Args: {
                    p_last_id?: number;
                    p_limit?: number;
                    p_user_id: string;
                };
                Returns: {
                    id: number;
                    title: string;
                }[];
            };
            fn_list_missing_summary_embeddings: {
                Args: {
                    p_last_id?: number;
                    p_limit?: number;
                    p_user_id: string;
                };
                Returns: {
                    id: number;
                    markdown: string;
                    summary_title: string;
                }[];
            };
            fn_list_missing_tag_embeddings: {
                Args: {
                    p_last_id?: number;
                    p_limit?: number;
                    p_user_id: string;
                };
                Returns: {
                    description: string;
                    id: number;
                    tag_name: string;
                }[];
            };
            fn_list_old_podcast_episodes: {
                Args: { p_cutoff: string; p_user_id: string };
                Returns: {
                    audio_url: string;
                    id: number;
                }[];
            };
            fn_list_recent_feed_items: {
                Args: { p_limit?: number; p_since: string; p_user_id: string };
                Returns: {
                    description: string;
                    feed_title: string;
                    id: number;
                    link: string;
                    published_at: string;
                    title: string;
                }[];
            };
            fn_mark_subscription_fetched: {
                Args: {
                    p_fetched_at: string;
                    p_subscription_id: number;
                    p_user_id: string;
                };
                Returns: {
                    feed_title: string;
                    feed_url: string;
                    id: number;
                    last_fetched_at: string;
                    next_fetch_at: string;
                    user_id: string;
                }[];
            };
            fn_soft_delete_podcast_episode: {
                Args: { p_episode_id: number; p_user_id: string };
                Returns: undefined;
            };
            fn_update_daily_summary: {
                Args: {
                    p_id: number;
                    p_markdown?: string;
                    p_script_tts_duration_sec?: number;
                    p_summary_emb?: string;
                    p_summary_title?: string;
                    p_user_id: string;
                };
                Returns: {
                    created_at: string;
                    id: number;
                    markdown: string;
                    script_text: string | null;
                    script_tts_duration_sec: number | null;
                    soft_deleted: boolean;
                    summary_date: string;
                    summary_emb: string | null;
                    summary_title: string;
                    updated_at: string;
                    user_id: string;
                };
                SetofOptions: {
                    from: "*";
                    to: "daily_summaries";
                    isOneToOne: true;
                    isSetofReturn: false;
                };
            };
            fn_update_feed_item_embedding: {
                Args: { p_id: number; p_user_id: string; p_vec: number[] };
                Returns: undefined;
            };
            fn_update_podcast_audio_url: {
                Args: {
                    p_audio_url: string;
                    p_duration_sec: number;
                    p_episode_id: number;
                    p_user_id: string;
                };
                Returns: {
                    audio_url: string;
                    created_at: string;
                    id: number;
                    soft_deleted: boolean;
                    summary_id: number;
                    title: string;
                    title_emb: string | null;
                    updated_at: string;
                    user_id: string;
                };
                SetofOptions: {
                    from: "*";
                    to: "podcast_episodes";
                    isOneToOne: true;
                    isSetofReturn: false;
                };
            };
            fn_update_podcast_embedding:
                | {
                      Args: {
                          p_id: number;
                          p_user_id: string;
                          p_vec: number[];
                      };
                      Returns: undefined;
                  }
                | {
                      Args: { p_id: number; p_user_id: string; p_vec: string };
                      Returns: undefined;
                  };
            fn_update_summary_embedding: {
                Args: { p_id: number; p_user_id: string; p_vec: number[] };
                Returns: undefined;
            };
            fn_update_tag_embedding: {
                Args: { p_id: number; p_user_id: string; p_vec: number[] };
                Returns: undefined;
            };
            fn_upsert_daily_summary: {
                Args: {
                    p_markdown: string;
                    p_summary_date: string;
                    p_summary_emb: number[];
                    p_summary_title: string;
                    p_user_id: string;
                };
                Returns: {
                    created_at: string;
                    id: number;
                    markdown: string;
                    script_text: string | null;
                    script_tts_duration_sec: number | null;
                    soft_deleted: boolean;
                    summary_date: string;
                    summary_emb: string | null;
                    summary_title: string;
                    updated_at: string;
                    user_id: string;
                };
                SetofOptions: {
                    from: "*";
                    to: "daily_summaries";
                    isOneToOne: true;
                    isSetofReturn: false;
                };
            };
            fn_upsert_podcast_episode: {
                Args: {
                    p_summary_id: number;
                    p_title: string;
                    p_title_emb: number[];
                    p_user_id: string;
                };
                Returns: {
                    audio_url: string;
                    created_at: string;
                    id: number;
                    soft_deleted: boolean;
                    summary_id: number;
                    title: string;
                    title_emb: string | null;
                    updated_at: string;
                    user_id: string;
                };
                SetofOptions: {
                    from: "*";
                    to: "podcast_episodes";
                    isOneToOne: true;
                    isSetofReturn: false;
                };
            };
            get_embedding_dimensions: { Args: never; Returns: number };
            get_tag_hierarchy: { Args: never; Returns: Json };
            get_tag_path: { Args: { p_tag_id: number }; Returns: Json };
            get_tag_statistics: {
                Args: never;
                Returns: {
                    root_tags: number;
                    total_feed_items_tagged: number;
                    total_subscriptions_tagged: number;
                    total_tags: number;
                }[];
            };
            get_tag_subtree: { Args: { p_tag_id: number }; Returns: Json };
            rebuild_vector_index: {
                Args: { p_index_name: string };
                Returns: string;
            };
            restore_user_account: {
                Args: { p_user_id: string };
                Returns: {
                    restored: boolean;
                }[];
            };
            search_feed_items_by_vector: {
                Args: {
                    match_count: number;
                    match_threshold: number;
                    query_embedding: number[];
                };
                Returns: {
                    description: string;
                    feed_title: string;
                    id: number;
                    link: string;
                    published_at: string;
                    similarity: number;
                    title: string;
                }[];
            };
            search_podcast_episodes_by_vector: {
                Args: {
                    match_count: number;
                    match_threshold: number;
                    query_embedding: number[];
                };
                Returns: {
                    audio_url: string;
                    created_at: string;
                    id: number;
                    similarity: number;
                    summary_id: number;
                    title: string;
                }[];
            };
            search_summaries_by_vector:
                | {
                      Args: {
                          match_count: number;
                          match_threshold: number;
                          query_embedding: number[];
                      };
                      Returns: {
                          id: number;
                          markdown: string;
                          script_text: string;
                          similarity: number;
                          summary_date: string;
                          summary_title: string;
                      }[];
                  }
                | {
                      Args: {
                          match_count: number;
                          match_threshold: number;
                          query_embedding: string;
                      };
                      Returns: {
                          id: number;
                          markdown: string;
                          script_text: string;
                          similarity: number;
                          summary_date: string;
                          summary_title: string;
                      }[];
                  };
            search_tags_by_vector: {
                Args: {
                    match_count: number;
                    match_threshold: number;
                    query_embedding: number[];
                };
                Returns: {
                    id: number;
                    parent_tag_id: number;
                    similarity: number;
                    tag_name: string;
                }[];
            };
            soft_delete_user_account: {
                Args: { p_user_id: string };
                Returns: {
                    deleted_at: string;
                    soft_deleted: boolean;
                }[];
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
    keyof Database,
    "public"
>];

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
          Row: infer R;
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
            DefaultSchema["Views"])
      ? (DefaultSchema["Tables"] &
            DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R;
        }
          ? R
          : never
      : never;

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema["Tables"]
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
          Insert: infer I;
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
      ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I;
        }
          ? I
          : never
      : never;

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema["Tables"]
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
          Update: infer U;
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
      ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U;
        }
          ? U
          : never
      : never;

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
        | keyof DefaultSchema["Enums"]
        | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
      ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema["CompositeTypes"]
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
      ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
      : never;

export const Constants = {
    auth: {
        Enums: {
            aal_level: ["aal1", "aal2", "aal3"],
            code_challenge_method: ["s256", "plain"],
            factor_status: ["unverified", "verified"],
            factor_type: ["totp", "webauthn", "phone"],
            oauth_authorization_status: [
                "pending",
                "approved",
                "denied",
                "expired",
            ],
            oauth_client_type: ["public", "confidential"],
            oauth_registration_type: ["dynamic", "manual"],
            oauth_response_type: ["code"],
            one_time_token_type: [
                "confirmation_token",
                "reauthentication_token",
                "recovery_token",
                "email_change_token_new",
                "email_change_token_current",
                "phone_change_token",
            ],
        },
    },
    extensions: {
        Enums: {},
    },
    public: {
        Enums: {},
    },
} as const;
