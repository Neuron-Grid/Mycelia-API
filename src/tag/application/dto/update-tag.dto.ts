import { IsNumber, IsOptional, IsString } from 'class-validator'

export class UpdateTagDto {
    @IsOptional()
    @IsString()
    newName?: string

    @IsOptional()
    @IsNumber()
    newParentTagId?: number | null
}
