import {
    IsBoolean,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateIf,
} from "class-validator";

export class CreateSummaryDto {
    /** The text to summarize. Either text or fileRef must be provided. */
    @IsString()
    @IsOptional()
    @ValidateIf((o) => !o.fileRef)
    @IsNotEmpty()
    text?: string;

    /** The file reference to summarize. Either text or fileRef must be provided. */
    @IsString()
    @IsOptional()
    @ValidateIf((o) => !o.text)
    @IsNotEmpty()
    fileRef?: string;

    /** If true, the summary will be saved to the database. */
    @IsBoolean()
    @IsOptional()
    save?: boolean = false;
}
