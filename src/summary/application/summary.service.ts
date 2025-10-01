import { Inject, Injectable, Logger } from "@nestjs/common";
import {
    GeminiSummaryRequest,
    LLM_SERVICE,
    LlmService,
} from "@/llm/application/services/llm.service";
import { CloudflareR2Service } from "@/podcast/cloudflare-r2.service";
import { CreateSummaryDto } from "@/summary/dto/create-summary.dto";
import { SummaryRepository } from "@/summary/infrastructure/summary.repository";

@Injectable()
export class SummaryService {
    private readonly logger = new Logger(SummaryService.name);

    constructor(
        @Inject(LLM_SERVICE) private readonly llmService: LlmService,
        private readonly summaryRepository: SummaryRepository,
        private readonly cloudflareR2Service: CloudflareR2Service,
    ) {}

    async createSummary(
        userId: string,
        createSummaryDto: CreateSummaryDto,
    ): Promise<{ summary: string; id?: number }> {
        const { text, fileRef, save } = createSummaryDto;

        let contentToSummarize = "";
        let sourceName = "text_input";

        // fileRefが指定された場合、Cloudflare R2からコンテンツを取得
        if (fileRef) {
            try {
                this.logger.log(`Fetching content from fileRef: ${fileRef}`);

                // fileRefがURLの場合はバケット/キーを抽出、それ以外は手動指定
                const location = fileRef.startsWith("http")
                    ? this.cloudflareR2Service.extractObjectLocationFromUrl(
                          fileRef,
                      )
                    : { bucket: null, key: fileRef };
                const objectKey = location.key;
                const objectBucket = location.bucket ?? undefined;

                if (!objectKey) {
                    throw new Error(`Invalid fileRef format: ${fileRef}`);
                }

                // 所有チェック: 指定キーが当該ユーザーの領域配下であることを強制
                if (
                    !this.cloudflareR2Service.isUserFile(
                        objectKey,
                        userId,
                        objectBucket,
                    )
                ) {
                    this.logger.warn(
                        `Access denied to fileRef for user ${userId}: ${objectKey}`,
                    );
                    throw new Error(
                        "Access denied: fileRef must belong to the requesting user",
                    );
                }

                // セキュリティチェック: ユーザーが自分のファイルにのみアクセス可能かチェック
                const fileContent = objectBucket
                    ? await this.cloudflareR2Service.getObject(
                          objectKey,
                          objectBucket,
                      )
                    : await this.cloudflareR2Service.getObject(objectKey);

                // ファイルサイズ制限（1MB以下に制限）
                const maxSize = 1024 * 1024; // 1MB
                if (fileContent.length > maxSize) {
                    this.logger.warn(
                        `File too large for processing: ${fileContent.length} bytes, max: ${maxSize} bytes`,
                    );
                    throw new Error("File too large for processing (max 1MB)");
                }

                contentToSummarize = fileContent;
                sourceName = objectKey;
                this.logger.log(
                    `Successfully retrieved ${fileContent.length} characters from ${objectKey}`,
                );
            } catch (error) {
                this.logger.warn(
                    `Failed to fetch fileRef: ${fileRef}`,
                    error.message,
                );

                // フォールバック: textがある場合はそれを使用、なければエラー
                if (text) {
                    this.logger.log("Falling back to provided text content");
                    contentToSummarize = text;
                    sourceName = "text_input_fallback";
                } else {
                    throw new Error(
                        `Failed to retrieve content from fileRef and no text provided: ${error.message}`,
                    );
                }
            }
        } else if (text) {
            contentToSummarize = text;
            sourceName = "text_input";
        } else {
            throw new Error("Either text or fileRef must be provided");
        }

        if (!contentToSummarize.trim()) {
            throw new Error("Content to summarize is empty");
        }

        const llmRequest: GeminiSummaryRequest = {
            articles: [
                {
                    title: `Summary for ${sourceName}`,
                    content: contentToSummarize,
                    url: fileRef || "",
                    publishedAt: new Date().toISOString(),
                    language: "ja", // Assuming Japanese, could be detected or specified.
                },
            ],
            targetLanguage: "ja",
        };

        const { content: summary } =
            await this.llmService.generateSummary(llmRequest);

        if (save) {
            const id = await this.summaryRepository.save(userId, {
                sourceName: sourceName,
                summaryMd: summary,
            });
            return { summary, id };
        }

        return { summary };
    }
}
