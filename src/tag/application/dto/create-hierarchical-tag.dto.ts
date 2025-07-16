import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateHierarchicalTagDto {
    @ApiProperty({
        description: 'タグ名',
        minLength: 1,
        maxLength: 100,
        example: 'テクノロジー',
    })
    @IsString()
    @Length(1, 100)
    tag_name!: string;

    @ApiPropertyOptional({
        description: '親タグのID（ルートタグの場合はnull）',
        example: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    parent_tag_id?: number;

    @ApiPropertyOptional({
        description: 'タグの説明',
        maxLength: 500,
        example: 'プログラミング、AI、ガジェットなどの技術関連記事',
    })
    @IsOptional()
    @IsString()
    @Length(0, 500)
    description?: string;

    @ApiPropertyOptional({
        description: 'タグの色（Hex形式）',
        pattern: '^#[0-9A-Fa-f]{6}$',
        example: '#3B82F6',
    })
    @IsOptional()
    @IsString()
    color?: string;
}
