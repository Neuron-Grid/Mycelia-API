import { ApiProperty } from "@nestjs/swagger";

export class CheckFavoriteResponseDto {
    @ApiProperty({ description: "お気に入り判定", example: true })
    favorited!: boolean;
}
