import * as fs from "node:fs/promises";
import * as path from "node:path";
import { protos, TextToSpeechClient } from "@google-cloud/text-to-speech";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v4 as uuidv4 } from "uuid";
import { CloudflareR2Service } from "./cloudflare-r2.service";

export interface SpeechSynthesisOptions {
    speakingRate?: number;
    pitch?: number;
    sampleRateHertz?: number;
    effectsProfileIds?: string[];
}

type GoogleTtsCredentials = {
    client_email: string;
    private_key: string;
    project_id?: string;
};

@Injectable()
export class PodcastTtsService {
    private readonly logger = new Logger(PodcastTtsService.name);
    private readonly client: TextToSpeechClient;

    constructor(
        private readonly r2: CloudflareR2Service,
        private readonly configService: ConfigService,
    ) {
        this.client = this.createClient();
    }

    private readonly defaultSpeakingRate = 1.0;
    private readonly defaultPitch = 0;

    // 音声を合成し、Cloudflare R2にアップロードして署名付きURLを返す
    async synthesizeAndUploadToR2(
        text: string,
        language: "ja-JP" | "en-US",
        bucket: string,
        keyPrefix = "",
        options?: SpeechSynthesisOptions,
    ): Promise<string> {
        const audioBuffer = await this.synthesizeNewsVoice(
            text,
            language,
            options,
        );
        const key = `${keyPrefix}${uuidv4()}.opus`;
        const { publicUrl } = await this.r2.uploadFile(
            bucket,
            key,
            audioBuffer,
            "audio/ogg",
            {
                language,
            },
        );
        return publicUrl;
    }

    // ニュースキャスター向けの音声で、指定テキストを日本語または英語で合成
    // @param text 合成するテキスト
    // @param language 'ja-JP' | 'en-US'
    // @returns 音声ファイルのバッファ
    async synthesizeNewsVoice(
        text: string,
        language: "ja-JP" | "en-US" = "ja-JP",
        options?: SpeechSynthesisOptions,
    ): Promise<Buffer> {
        // ニュースキャスター向けのvoice選択
        const voice: protos.google.cloud.texttospeech.v1.IVoiceSelectionParams =
            {
                languageCode: language,
                name:
                    language === "ja-JP" ? "ja-JP-Standard-C" : "en-US-News-K",
                ssmlGender: "FEMALE",
            };

        const speakingRate = options?.speakingRate ?? this.defaultSpeakingRate;
        const pitch = options?.pitch ?? this.defaultPitch;
        const audioConfig: protos.google.cloud.texttospeech.v1.IAudioConfig = {
            audioEncoding: "OGG_OPUS",
            speakingRate,
            pitch,
        };

        if (options?.sampleRateHertz) {
            audioConfig.sampleRateHertz = options.sampleRateHertz;
        }

        if (
            options?.effectsProfileIds &&
            options.effectsProfileIds.length > 0
        ) {
            audioConfig.effectsProfileId = options.effectsProfileIds;
        }

        const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest =
            {
                input: { text },
                voice,
                audioConfig,
            };

        const [response] = await this.client.synthesizeSpeech(request);

        if (!response.audioContent) {
            throw new Error("音声合成に失敗しました");
        }

        return Buffer.from(response.audioContent as Uint8Array);
    }

    // 一時ファイルとして音声を書き出す（テスト・デバッグ用）
    async synthesizeToFile(
        text: string,
        language: "ja-JP" | "en-US" = "ja-JP",
        outDir = "./tmp",
        options?: SpeechSynthesisOptions,
    ): Promise<string> {
        const audioBuffer = await this.synthesizeNewsVoice(
            text,
            language,
            options,
        );
        await fs.mkdir(outDir, { recursive: true });
        const filePath = path.join(outDir, `${uuidv4()}.opus`);
        await fs.writeFile(filePath, audioBuffer);
        this.logger.log(`音声ファイル生成: ${filePath}`);
        return filePath;
    }

    // 音声を生成し、バッファとして返す
    async generateSpeech(
        text: string,
        language: "ja-JP" | "en-US" = "ja-JP",
        options?: SpeechSynthesisOptions,
    ): Promise<Buffer> {
        return await this.synthesizeNewsVoice(text, language, options);
    }

    private createClient(): TextToSpeechClient {
        const options = this.buildClientOptions();
        return new TextToSpeechClient(options);
    }

    private buildClientOptions(): ConstructorParameters<
        typeof TextToSpeechClient
    >[0] {
        const inlineCredentials = this.configService.get<string>(
            "GOOGLE_TTS_CREDENTIALS",
        );
        const credentials = inlineCredentials
            ? this.parseInlineCredentials(inlineCredentials)
            : null;

        const keyFilename = this.configService.get<string>(
            "GOOGLE_APPLICATION_CREDENTIALS",
        );

        const options: ConstructorParameters<typeof TextToSpeechClient>[0] = {};

        if (credentials) {
            options.credentials = credentials;
            if (credentials.project_id) {
                options.projectId = credentials.project_id;
            }
            this.logger.debug("Using inline Google TTS credentials");
            return options;
        }

        if (keyFilename) {
            options.keyFilename = keyFilename;
            this.logger.debug(
                `Using Google TTS credentials file at ${keyFilename}`,
            );
            return options;
        }

        this.logger.warn(
            "Google TTS credentials not provided; relying on default ADC environment",
        );
        return options;
    }

    private parseInlineCredentials(
        rawCredentials: string,
    ): GoogleTtsCredentials | null {
        const trimmed = rawCredentials.trim();
        if (!trimmed) {
            return null;
        }

        const jsonString = this.maybeDecodeBase64(trimmed);
        try {
            const parsed = JSON.parse(jsonString) as Record<string, unknown>;
            const clientEmail = parsed.client_email;
            const privateKey = parsed.private_key;
            if (
                typeof clientEmail === "string" &&
                typeof privateKey === "string"
            ) {
                const projectId =
                    typeof parsed.project_id === "string"
                        ? parsed.project_id
                        : undefined;
                return {
                    client_email: clientEmail,
                    private_key: privateKey,
                    project_id: projectId,
                };
            }
            this.logger.error(
                "Invalid GOOGLE_TTS_CREDENTIALS payload: missing client_email/private_key",
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Failed to parse GOOGLE_TTS_CREDENTIALS: ${message}`,
            );
        }
        return null;
    }

    private maybeDecodeBase64(value: string): string {
        if (value.startsWith("{")) {
            return value;
        }

        try {
            return Buffer.from(value, "base64").toString("utf-8");
        } catch {
            return value;
        }
    }
}
