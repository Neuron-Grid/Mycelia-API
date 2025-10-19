import {
    IsBoolean,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateIf,
} from "class-validator";
import { AcceptSnakeCase } from "@/common/decorators/accept-snake-case.decorator";

export class CreateSummaryDto {
    /** The text to summarize. Either text or fileRef must be provided. */
    @AcceptSnakeCase()
    @IsString()
    @IsOptional()
    @ValidateIf((o) => !o.fileRef)
    @IsNotEmpty()
    text?: string;

    /** The file reference to summarize. Either text or fileRef must be provided. */
    @AcceptSnakeCase()
    @IsString()
    @IsOptional()
    @ValidateIf((o) => !o.text)
    @IsNotEmpty()
    fileRef?: string;

    /** If true, the summary will be saved to the database. */
    @AcceptSnakeCase()
    @IsBoolean()
    @IsOptional()
    save?: boolean = false;
}
