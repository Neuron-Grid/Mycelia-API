import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, Min } from "class-validator";

// ポッドキャストエピソード更新DTO
// @description クライアントからのポッドキャストエピソード更新リクエスト用DTO
export class UpdatePodcastEpisodeDto {
    // エピソードタイトル
    // @type {string}
    @ApiProperty({
        description: "ポッドキャストエピソードのタイトル",
        example: "今日のニュース要約 - 2025年5月13日",
        required: false,
    })
    @IsString()
    @IsOptional()
    title?: string;
}

// ポッドキャストエピソード作成DTO
// @description 新しいポッドキャストエピソード作成用DTO
export class CreatePodcastEpisodeDto {
    // 要約ID
    // @type {number}
    @ApiProperty({
        description: "関連する要約のID",
        example: 123,
    })
    @IsNumber()
    @Min(1)
    summary_id: number;

    // エピソードタイトル（オプション）
    // @type {string}
    @ApiProperty({
        description: "ポッドキャストエピソードのタイトル",
        example: "今日のニュース要約 - 2025年5月13日",
        required: false,
    })
    @IsString()
    @IsOptional()
    title?: string;
}

// ポッドキャストエピソードレスポンスDTO
// @description サーバーから返却されるポッドキャストエピソード情報
export class PodcastEpisodeResponseDto {
    // エピソードID
    // @type {number}
    @ApiProperty({
        description: "ポッドキャストエピソードのID",
        example: 1,
    })
    id: number;

    // ユーザーID
    // @type {string}
    @ApiProperty({
        description: "エピソードの所有者ユーザーID",
        example: "user-uuid-123",
    })
    user_id: string;

    // 要約ID
    // @type {number}
    @ApiProperty({
        description: "関連する要約のID",
        example: 123,
    })
    summary_id: number;

    // エピソードタイトル
    // @type {string | null}
    @ApiProperty({
        description: "ポッドキャストエピソードのタイトル",
        example: "今日のニュース要約 - 2025年5月13日",
        nullable: true,
    })
    title: string | null;

    // 音声ファイルURL
    // @type {string | null}
    @ApiProperty({
        description: "音声ファイルのURL",
        example: "https://storage.example.com/episodes/episode-123.mp3",
        nullable: true,
    })
    audio_url: string | null;

    // ソフト削除フラグ
    // @type {boolean}
    @ApiProperty({
        description: "ソフト削除されているかどうか",
        example: false,
    })
    soft_deleted: boolean;

    // 作成日時
    // @type {string}
    @ApiProperty({
        description: "作成日時",
        example: "2025-05-13T07:30:00.000Z",
    })
    created_at: string;

    // 最終更新日時
    // @type {string}
    @ApiProperty({
        description: "最終更新日時",
        example: "2025-05-13T07:30:00.000Z",
    })
    updated_at: string;
}

// ポッドキャストエピソード一覧レスポンスDTO
// @description ページネーション対応のエピソード一覧
export class PodcastEpisodeListResponseDto {
    // エピソード一覧
    // @type {PodcastEpisodeResponseDto[]}
    @ApiProperty({
        description: "ポッドキャストエピソード一覧",
        type: [PodcastEpisodeResponseDto],
    })
    episodes: PodcastEpisodeResponseDto[];

    // 合計件数
    // @type {number}
    @ApiProperty({
        description: "合計エピソード数",
        example: 50,
    })
    total: number;

    // 現在のページ
    // @type {number}
    @ApiProperty({
        description: "現在のページ番号（1から開始）",
        example: 1,
    })
    page: number;

    // 1ページあたりの件数
    // @type {number}
    @ApiProperty({
        description: "1ページあたりの件数",
        example: 20,
    })
    limit: number;

    // 総ページ数
    // @type {number}
    @ApiProperty({
        description: "総ページ数",
        example: 3,
    })
    total_pages: number;
}

// ポッドキャストエピソード生成リクエストDTO
// @description ポッドキャストエピソード生成ジョブ用DTO
export class GeneratePodcastEpisodeDto {
    // 要約ID
    // @type {number}
    @ApiProperty({
        description: "音声化したい要約のID",
        example: 123,
    })
    @IsNumber()
    @Min(1)
    summary_id: number;

    // カスタムプロンプト（オプション）
    // @type {string}
    @ApiProperty({
        description: "カスタムプロンプト（オプション）",
        example: "もう少し詳しく解説してください",
        required: false,
    })
    @IsString()
    @IsOptional()
    prompt?: string;
}

// ポッドキャストエピソード生成ジョブレスポンスDTO
// @description 生成ジョブの結果
export class PodcastGenerationJobResponseDto {
    // メッセージ
    // @type {string}
    @ApiProperty({
        description: "ジョブ開始メッセージ",
        example:
            "Podcast generation job (ID: job-123) has been queued for summary ID 123.",
    })
    message: string;

    // ジョブID
    // @type {string}
    @ApiProperty({
        description: "生成ジョブのID",
        example: "job-123",
        required: false,
    })
    job_id?: string;

    // エピソードID（すでに存在する場合）
    // @type {number}
    @ApiProperty({
        description: "作成されたエピソードのID",
        example: 456,
        required: false,
    })
    episode_id?: number;
}
