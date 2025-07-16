import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class CreateSummaryDto {
    @ApiProperty({
        description: 'The text to summarize. Either text or fileRef must be provided.',
        required: false,
    })
    @IsString()
    @IsOptional()
    @ValidateIf((o) => !o.fileRef)
    @IsNotEmpty()
    text?: string;

    @ApiProperty({
        description: 'The file reference to summarize. Either text or fileRef must be provided.',
        required: false,
    })
    @IsString()
    @IsOptional()
    @ValidateIf((o) => !o.text)
    @IsNotEmpty()
    fileRef?: string;

    @ApiProperty({
        description: 'If true, the summary will be saved to the database.',
        default: false,
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    save?: boolean = false;
}
