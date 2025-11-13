import type { GoogleTtsConfig } from "@/config/app-env";

export function buildGoogleTtsConfig(env: NodeJS.ProcessEnv): GoogleTtsConfig {
    const inlineCredentialsRaw = env.GOOGLE_TTS_CREDENTIALS?.trim();
    const credentialsFile = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

    return {
        inlineCredentialsRaw:
            inlineCredentialsRaw && inlineCredentialsRaw.length > 0
                ? inlineCredentialsRaw
                : undefined,
        credentialsFile:
            credentialsFile && credentialsFile.length > 0
                ? credentialsFile
                : undefined,
    };
}
