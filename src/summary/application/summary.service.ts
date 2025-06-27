import { Inject, Injectable } from "@nestjs/common";
import {
    GeminiSummaryRequest,
    LLM_SERVICE,
    LlmService,
} from "../../llm/llm.service";
import { CreateSummaryDto } from "../dto/create-summary.dto";
import { SummaryRepository } from "../infrastructure/summary.repository";

@Injectable()
export class SummaryService {
    constructor(
        @Inject(LLM_SERVICE) private readonly llmService: LlmService,
        private readonly summaryRepository: SummaryRepository,
    ) {}

    async createSummary(
        userId: string,
        createSummaryDto: CreateSummaryDto,
    ): Promise<{ summary: string; id?: number }> {
        const { text, fileRef, save } = createSummaryDto;

        // TODO: If fileRef is provided, fetch content from the reference.
        // For now, assume text is always provided or fileRef is the content itself.
        const contentToSummarize = text || fileRef || "";
        const sourceName = fileRef || "text_input";

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

        const { content: summary } = await this.llmService.generateSummary(
            llmRequest,
        );

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
