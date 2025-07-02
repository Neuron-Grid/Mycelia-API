import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class TagHierarchyDto {
    @ApiProperty({
        description: 'タグID',
        example: 1,
    })
    id!: number

    @ApiProperty({
        description: 'タグ名',
        example: 'テクノロジー',
    })
    tag_name!: string

    @ApiPropertyOptional({
        description: '親タグID',
        example: null,
    })
    parent_tag_id!: number | null

    @ApiPropertyOptional({
        description: 'タグの説明',
        example: 'プログラミング、AI、ガジェットなどの技術関連記事',
    })
    description?: string

    @ApiPropertyOptional({
        description: 'タグの色（Hex形式）',
        example: '#3B82F6',
    })
    color?: string

    @ApiProperty({
        description: '子タグ一覧',
        type: [Object],
    })
    children!: TagHierarchyDto[]

    @ApiProperty({
        description: 'ルートからのパス',
        type: [String],
        example: ['テクノロジー', 'プログラミング'],
    })
    path!: string[]

    @ApiProperty({
        description: '階層レベル（0がルート）',
        example: 1,
    })
    level!: number

    @ApiPropertyOptional({
        description: 'このタグに紐づくフィード数',
        example: 5,
    })
    feed_count?: number
}

export class TagWithPathDto {
    @ApiProperty({
        description: 'タグID',
        example: 1,
    })
    id!: number

    @ApiProperty({
        description: 'タグ名',
        example: 'JavaScript',
    })
    tag_name!: string

    @ApiPropertyOptional({
        description: '親タグID',
        example: 2,
    })
    parent_tag_id!: number | null

    @ApiProperty({
        description: 'フルパス（> で区切り）',
        example: 'テクノロジー > プログラミング > JavaScript',
    })
    full_path!: string

    @ApiProperty({
        description: 'パス配列',
        type: [String],
        example: ['テクノロジー', 'プログラミング', 'JavaScript'],
    })
    path_array!: string[]

    @ApiProperty({
        description: '階層レベル（0がルート）',
        example: 2,
    })
    level!: number
}

export class MoveTagDto {
    @ApiPropertyOptional({
        description: '新しい親タグのID（ルートに移動する場合はnull）',
        example: 3,
    })
    new_parent_id?: number | null
}
