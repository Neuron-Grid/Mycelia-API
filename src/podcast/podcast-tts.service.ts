import * as fs from "node:fs/promises";
import * as path from "node:path";
import { protos, TextToSpeechClient } from "@google-cloud/text-to-speech";
import { Injectable, Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { CloudflareR2Service } from "./cloudflare-r2.service";

@Injectable()
export class PodcastTtsService {
    private readonly logger = new Logger(PodcastTtsService.name);
    private readonly client: TextToSpeechClient;

    constructor(private readonly r2: CloudflareR2Service) {
        this.client = new TextToSpeechClient();
    }

    // 音声を合成し、Cloudflare R2にアップロードして署名付きURLを返す
    async synthesizeAndUploadToR2(
        text: string,
        language: "ja-JP" | "en-US",
        bucket: string,
        keyPrefix = "",
    ): Promise<string> {
        const audioBuffer = await this.synthesizeNewsVoice(text, language);
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
    ): Promise<Buffer> {
        // ニュースキャスター向けのvoice選択
        const voice: protos.google.cloud.texttospeech.v1.IVoiceSelectionParams =
            {
                languageCode: language,
                name:
                    language === "ja-JP" ? "ja-JP-Standard-C" : "en-US-News-K",
                ssmlGender: "FEMALE",
            };

        const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest =
            {
                input: { text },
                voice,
                audioConfig: {
                    audioEncoding: "OGG_OPUS",
                    speakingRate: 1.0,
                    pitch: 0,
                },
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
    ): Promise<string> {
        const audioBuffer = await this.synthesizeNewsVoice(text, language);
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
    ): Promise<Buffer> {
        return await this.synthesizeNewsVoice(text, language);
    }
}
