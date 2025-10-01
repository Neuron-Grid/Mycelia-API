import type { ValidationOptions } from "class-validator";
import { Matches } from "class-validator";

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Ensures a color string matches the strict #RRGGBB hex format.
 */
export function IsHexColorStrict(
    validationOptions?: ValidationOptions,
): PropertyDecorator {
    return Matches(HEX_COLOR_REGEX, {
        message: "color must be a hex color in the format #RRGGBB",
        ...validationOptions,
    });
}
