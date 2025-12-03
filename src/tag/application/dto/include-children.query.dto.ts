import { Transform } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

export class IncludeChildrenQueryDto {
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === undefined || value === null || value === "") {
            return undefined;
        }
        if (typeof value === "boolean") {
            return value;
        }
        if (typeof value === "string") {
            const normalized = value.trim().toLowerCase();
            if (normalized === "true" || normalized === "1") return true;
            if (normalized === "false" || normalized === "0") return false;
        }
        return value;
    })
    includeChildren?: boolean;
}
