import { Injectable, NotFoundException } from "@nestjs/common";
import { JobsService } from "src/jobs/jobs.service";
import { PodcastConfigInput } from "../domain/podcast-config.entity";
import { PodcastConfigRepository } from "../infrastructure/podcast-config.repository";
import { PodcastConfigResponseDto } from "./dto/podcast-config.dto";
import { PodcastConfigMapper } from "./podcast-config.mapper";

@Injectable()
export class PodcastConfigService {
    constructor(
        private readonly podcastConfigRepository: PodcastConfigRepository,
        private readonly jobsService: JobsService,
    ) {}

    //  ユーザーのポッドキャスト設定を取得
    //  @param userId ユーザーID
    //  @returns ポッドキャスト設定
    async getUserPodcastConfig(
        userId: string,
    ): Promise<PodcastConfigResponseDto> {
        const config = await this.podcastConfigRepository.findByUserId(userId);
        if (!config) {
            return PodcastConfigMapper.createDefaultResponse();
        }
        return PodcastConfigMapper.toResponseDto(config);
    }

    //  ポッドキャスト設定を更新
    //  @param userId ユーザーID
    //  @param input 更新内容
    //  @returns 更新後のポッドキャスト設定
    async updatePodcastConfig(
        userId: string,
        input: PodcastConfigInput,
    ): Promise<PodcastConfigResponseDto> {
        const updated = await this.podcastConfigRepository.upsert(
            userId,
            input,
        );
        if (!updated) {
            throw new NotFoundException(
                "ポッドキャスト設定の更新に失敗しました",
            );
        }
        // 設定変更を即時にスケジュールへ反映（対象ユーザーのみ）
        await this.jobsService.rescheduleUserRepeatableJobs(userId);
        return PodcastConfigMapper.toResponseDto(updated);
    }

    //  指定時刻に実行すべきポッドキャスト設定を取得
    //  @param scheduleTime HH:MM形式の時刻（例: "07:30"）
    //  @returns ポッドキャスト設定の配列
    async findConfigsForScheduledTime(scheduleTime: string) {
        return await this.podcastConfigRepository.findEnabledByScheduleTime(
            scheduleTime,
        );
    }
}
