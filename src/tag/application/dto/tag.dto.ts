/**
 * タグのDTO（API出力用）
 */

export class TagDto {
    id!: number;

    tagName!: string;

    parentTagId!: number | null;

    description?: string | null;

    color?: string | null;
}
