import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator'

export class CreateTagDto {
    @IsNotEmpty()
    tagName: string

    @IsOptional()
    @IsNumber()
    parentTagId?: number
}
