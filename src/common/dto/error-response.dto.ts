import { ApiProperty } from "@nestjs/swagger";

export class ErrorResponseDto {
    @ApiProperty({ description: "HTTP status code", example: 400 })
    statusCode!: number;

    @ApiProperty({
        description: "Error message(s)",
        oneOf: [
            { type: "string", example: "Bad Request" },
            {
                type: "array",
                items: { type: "string" },
                example: ["email must be an email", "password is too short"],
            },
        ],
    })
    message!: string | string[];

    @ApiProperty({ description: "Short error label", example: "Bad Request" })
    error!: string;

    @ApiProperty({ description: "Request path", example: "/api/v1/example" })
    path!: string;

    @ApiProperty({
        description: "Timestamp in ISO 8601",
        example: "2024-08-30T12:34:56.789Z",
    })
    timestamp!: string;
}
